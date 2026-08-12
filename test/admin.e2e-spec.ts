import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRole } from './../src/models/user-role.enum';
import { AppModule } from './../src/app.module';
import { UserService } from './../src/modules/user/user.service';
import { User } from './../src/modules/user/entities/user.entity';

interface LoginBody {
  access_token: string;
}

interface UserBody {
  id: string;
  email: string;
  role: string;
}

describe('Admin (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let adminToken = '';
  let standardToken = '';
  let standardUserId = '';

  const adminEmail = `admin-${Date.now()}@example.com`;
  const standardEmail = `standard-${Date.now()}@example.com`;
  const password = 'supersecret123';
  const originalUrl = 'https://example.com/admin-path';

  const login = async (email: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return (res.body as LoginBody).access_token;
  };

  const bearer = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    userService = app.get(UserService);
    await userService.create(
      adminEmail,
      await bcrypt.hash(password, 10),
      UserRole.ADMIN,
    );
    const standard = await userService.create(
      standardEmail,
      await bcrypt.hash(password, 10),
    );
    standardUserId = standard.id;

    adminToken = await login(adminEmail);
    standardToken = await login(standardEmail);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /users rejects a missing token', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
  });

  it('GET /users rejects a non-admin user', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set(bearer(standardToken))
      .expect(403);
  });

  it('GET /users lists users for an admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .set(bearer(adminToken))
      .expect(200);

    const body = res.body as UserBody[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((item) => item.email === adminEmail)).toBe(true);
    expect(body.some((item) => item.email === standardEmail)).toBe(true);
    expect(body[0]).not.toHaveProperty('password');
    expect(body[0]).not.toHaveProperty('passwordHash');
  });

  it('GET /users/:id returns the user info for an admin', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${standardUserId}`)
      .set(bearer(adminToken))
      .expect(200);

    const body = res.body as UserBody;
    expect(body.id).toBe(standardUserId);
    expect(body.email).toBe(standardEmail);
    expect(body.role).toBe(UserRole.STANDARD);
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('GET /users/:id returns 404 for an unknown user', async () => {
    await request(app.getHttpServer())
      .get('/users/does-not-exist')
      .set(bearer(adminToken))
      .expect(404);
  });

  it('GET /users/:id rejects a non-admin user', async () => {
    await request(app.getHttpServer())
      .get(`/users/${standardUserId}`)
      .set(bearer(standardToken))
      .expect(403);
  });

  it('GET /users/:id/short-urls lists the user short urls for an admin', async () => {
    await request(app.getHttpServer())
      .post('/short-urls')
      .set(bearer(standardToken))
      .send({ originalUrl })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/users/${standardUserId}/short-urls`)
      .set(bearer(adminToken))
      .expect(200);

    const body = res.body as Array<{ userId: string; originalUrl: string }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body.some((item) => item.userId === standardUserId)).toBe(true);
    expect(body.some((item) => item.originalUrl === originalUrl)).toBe(true);
  });

  it('GET /users/:id/short-urls returns 404 for an unknown user', async () => {
    await request(app.getHttpServer())
      .get('/users/does-not-exist/short-urls')
      .set(bearer(adminToken))
      .expect(404);
  });

  it('GET /users/:id/short-urls rejects a non-admin user', async () => {
    await request(app.getHttpServer())
      .get(`/users/${standardUserId}/short-urls`)
      .set(bearer(standardToken))
      .expect(403);
  });

  it('PATCH /password rejects a missing token', async () => {
    await request(app.getHttpServer())
      .patch('/password')
      .send({ currentPassword: password, newPassword: 'new-password-123' })
      .expect(401);
  });

  it('PATCH /password rejects a non-admin user', async () => {
    await request(app.getHttpServer())
      .patch('/password')
      .set(bearer(standardToken))
      .send({ currentPassword: password, newPassword: 'new-password-123' })
      .expect(403);
  });

  it('PATCH /password rejects a short new password', async () => {
    await request(app.getHttpServer())
      .patch('/password')
      .set(bearer(adminToken))
      .send({ currentPassword: password, newPassword: 'short' })
      .expect(400);
  });

  it('PATCH /password rejects a wrong current password', async () => {
    await request(app.getHttpServer())
      .patch('/password')
      .set(bearer(adminToken))
      .send({
        currentPassword: 'wrong-current-password',
        newPassword: 'new-password-123',
      })
      .expect(401);
  });

  it('PATCH /password changes the admin password', async () => {
    const newPassword = 'rotated-password-456';

    await request(app.getHttpServer())
      .patch('/password')
      .set(bearer(adminToken))
      .send({ currentPassword: password, newPassword })
      .expect(200);

    const afterLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: newPassword })
      .expect(200);
    expect(
      (afterLogin.body as { mustChangePassword: boolean }).mustChangePassword,
    ).toBe(false);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password })
      .expect(401);

    await request(app.getHttpServer())
      .get('/users')
      .set(bearer(adminToken))
      .expect(401);
  });

  it('revokes sessions after a role change', async () => {
    const email = `demoted-${Date.now()}@example.com`;
    await userService.create(
      email,
      await bcrypt.hash(password, 10),
      UserRole.ADMIN,
    );

    const token = await login(email);
    await request(app.getHttpServer())
      .get('/users')
      .set(bearer(token))
      .expect(200);

    const user = await userService.findByEmail(email);
    expect(user).not.toBeNull();
    await userService.updateRole(user!.id, UserRole.STANDARD);

    await request(app.getHttpServer())
      .get('/users')
      .set(bearer(token))
      .expect(401);
  });

  it('revokes sessions when the user is deleted', async () => {
    const email = `deleted-${Date.now()}@example.com`;
    const created = await userService.create(
      email,
      await bcrypt.hash(password, 10),
    );

    const token = await login(email);
    await request(app.getHttpServer())
      .get('/auth/profile')
      .set(bearer(token))
      .expect(200);

    const repository = app.get<Repository<User>>(getRepositoryToken(User));
    await repository.delete(created.id);

    await request(app.getHttpServer())
      .get('/auth/profile')
      .set(bearer(token))
      .expect(401);
  });

  it('POST /auth/login reports mustChangePassword for an admin that must rotate', async () => {
    const email = `mustchange-${Date.now()}@example.com`;
    await userService.create(
      email,
      await bcrypt.hash(password, 10),
      UserRole.ADMIN,
      true,
    );

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(
      (res.body as { mustChangePassword: boolean }).mustChangePassword,
    ).toBe(true);
  });
});
