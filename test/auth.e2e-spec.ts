import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const email = `auth-${Date.now()}@example.com`;
const password = 'supersecret123';

interface UserBody {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface LoginBody {
  access_token: string;
  refresh_token: string;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register creates a user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    const body = res.body as UserBody;
    expect(body.email).toBe(email);
    expect(body.role).toBe('standard');
    expect(body.id).toBeDefined();
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('POST /auth/register rejects an existing email', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(409);
  });

  it('POST /auth/register rejects an invalid email', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password })
      .expect(400);
  });

  it('POST /auth/register rejects a short password', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'short@example.com', password: 'short' })
      .expect(400);
  });

  it('POST /auth/login returns an access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const body = res.body as LoginBody;
    expect(typeof body.access_token).toBe('string');
    expect(body.access_token.length).toBeGreaterThan(0);
    expect(typeof body.refresh_token).toBe('string');
    expect(body.refresh_token.length).toBeGreaterThan(0);
  });

  it('POST /auth/login rejects a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('POST /auth/login rejects an unknown email', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'unknown@example.com', password })
      .expect(401);
  });

  it('GET /auth/profile rejects a missing token', async () => {
    await request(app.getHttpServer()).get('/auth/profile').expect(401);
  });

  it('GET /auth/profile rejects an invalid token', async () => {
    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', 'Bearer not-a-valid-token')
      .expect(401);
  });

  it('GET /auth/profile returns the user for a valid token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const loginBody = login.body as LoginBody;

    const res = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${loginBody.access_token}`)
      .expect(200);

    expect(res.body).toMatchObject({ email });
    expect((res.body as { sub: string }).sub).toBeDefined();
  });

  it('POST /auth/refresh issues new tokens from a valid refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const { refresh_token: refreshToken } = login.body as LoginBody;

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(200);

    expect(typeof (res.body as LoginBody).access_token).toBe('string');
    expect(typeof (res.body as LoginBody).refresh_token).toBe('string');
    expect((res.body as LoginBody).refresh_token).not.toBe(refreshToken);
  });

  it('POST /auth/refresh rejects an invalid refresh token', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: 'not-a-real-token' })
      .expect(401);
  });

  it('POST /auth/refresh rejects a missing refresh token', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({})
      .expect(400);
  });

  it('POST /auth/logout revokes the refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const { refresh_token: refreshToken } = login.body as LoginBody;

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refresh_token: refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(401);
  });
});
