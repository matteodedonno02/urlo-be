import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcryptjs';
import { UserRole } from './../src/models/user-role.enum';
import { AppModule } from './../src/app.module';
import { UserService } from './../src/modules/user/user.service';

interface ShortUrlBody {
  id: string;
  userId: string;
  shortCode: string;
  originalUrl: string;
  visitCount: number;
}

interface LoginBody {
  access_token: string;
}

interface ProfileBody {
  sub: string;
}

describe('ShortUrl (e2e)', () => {
  let app: INestApplication<App>;
  let shortCode = '';
  let accessToken = '';
  let loginUserId = '';
  let foreignToken = '';
  let adminToken = '';

  const email = `shorturl-${Date.now()}@example.com`;
  const foreignEmail = `foreign-${Date.now()}@example.com`;
  const password = 'supersecret123';
  const originalUrl = 'https://example.com/path';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    accessToken = (login.body as LoginBody).access_token;

    const profile = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    loginUserId = (profile.body as ProfileBody).sub;

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: foreignEmail, password })
      .expect(201);

    const foreignLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: foreignEmail, password })
      .expect(200);

    foreignToken = (foreignLogin.body as LoginBody).access_token;

    const userService = app.get(UserService);
    const adminEmail = `admin-${Date.now()}@example.com`;
    await userService.create(
      adminEmail,
      await bcrypt.hash(password, 10),
      UserRole.ADMIN,
    );

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);

    adminToken = (adminLogin.body as LoginBody).access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /short-urls rejects a missing token', async () => {
    await request(app.getHttpServer())
      .post('/short-urls')
      .send({ originalUrl })
      .expect(401);
  });

  it('POST /short-urls creates a short url with an auto-generated shortCode', async () => {
    const res = await request(app.getHttpServer())
      .post('/short-urls')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ originalUrl })
      .expect(201);

    const body = res.body as ShortUrlBody;
    shortCode = body.shortCode;
    expect(body.shortCode).toHaveLength(6);
    expect(body.originalUrl).toBe(originalUrl);
    expect(body.visitCount).toBe(0);
    expect(body.userId).toBeDefined();
    expect(body.id).toBeDefined();
  });

  it('POST /short-urls rejects an invalid URL', async () => {
    await request(app.getHttpServer())
      .post('/short-urls')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ originalUrl: 'not a valid url' })
      .expect(400);
  });

  it('POST /short-urls rejects a non-http(s) scheme', async () => {
    await request(app.getHttpServer())
      .post('/short-urls')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ originalUrl: 'ftp://example.com' })
      .expect(400);
  });

  it('POST /short-urls rejects a private/internal URL', async () => {
    await request(app.getHttpServer())
      .post('/short-urls')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ originalUrl: 'http://192.168.1.1' })
      .expect(400);
  });

  it('POST /short-urls rejects a loopback URL', async () => {
    await request(app.getHttpServer())
      .post('/short-urls')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ originalUrl: 'http://localhost:8080' })
      .expect(400);
  });

  it('POST /short-urls rejects an unknown property', async () => {
    await request(app.getHttpServer())
      .post('/short-urls')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ originalUrl, shortCode: 'abc123' })
      .expect(400);
  });

  it('GET /short-urls rejects a missing token', async () => {
    await request(app.getHttpServer()).get('/short-urls').expect(401);
  });

  it('GET /short-urls rejects a non-admin user', async () => {
    await request(app.getHttpServer())
      .get('/short-urls')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('GET /short-urls lists short urls for an admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/short-urls')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = res.body as ShortUrlBody[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((item) => item.shortCode === shortCode)).toBe(true);
  });

  it('GET /short-urls/my rejects a missing token', async () => {
    await request(app.getHttpServer()).get('/short-urls/my').expect(401);
  });

  it('GET /short-urls/my lists only the logged-in user short urls', async () => {
    const res = await request(app.getHttpServer())
      .get('/short-urls/my')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as ShortUrlBody[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((item) => item.shortCode === shortCode)).toBe(true);
    expect(body.every((item) => item.userId === loginUserId)).toBe(true);
  });

  it('GET /short-urls/:shortCode redirects to the original URL', async () => {
    const res = await request(app.getHttpServer())
      .get(`/short-urls/${shortCode}`)
      .expect(302);

    expect(res.headers.location).toBe(originalUrl);
  });

  it('GET /short-urls/:shortCode increments the visit count', async () => {
    const res = await request(app.getHttpServer())
      .get('/short-urls/my')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as ShortUrlBody[];
    const item = body.find((entry) => entry.shortCode === shortCode);
    expect(item?.visitCount).toBeGreaterThanOrEqual(1);
  });

  it('GET /short-urls/:shortCode returns 404 for unknown code', async () => {
    await request(app.getHttpServer())
      .get('/short-urls/does-not-exist')
      .expect(404);
  });

  it('PATCH /short-urls/:id rejects a missing token', async () => {
    const list = await request(app.getHttpServer())
      .get('/short-urls/my')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body = list.body as ShortUrlBody[];
    const item = body.find((entry) => entry.shortCode === shortCode);

    await request(app.getHttpServer())
      .patch(`/short-urls/${item!.id}`)
      .send({ originalUrl })
      .expect(401);
  });

  it('PATCH /short-urls/:id rejects a non-owner', async () => {
    const list = await request(app.getHttpServer())
      .get('/short-urls/my')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body = list.body as ShortUrlBody[];
    const item = body.find((entry) => entry.shortCode === shortCode);
    expect(item?.userId).toBe(loginUserId);

    await request(app.getHttpServer())
      .patch(`/short-urls/${item!.id}`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .send({ originalUrl })
      .expect(403);
  });

  it('PATCH /short-urls/:id rejects an unsafe URL', async () => {
    const list = await request(app.getHttpServer())
      .get('/short-urls/my')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body = list.body as ShortUrlBody[];
    const item = body.find((entry) => entry.shortCode === shortCode);

    await request(app.getHttpServer())
      .patch(`/short-urls/${item!.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ originalUrl: 'http://169.254.169.254/latest/meta-data' })
      .expect(400);
  });

  it('PATCH /short-urls/:id updates the short url', async () => {
    const list = await request(app.getHttpServer())
      .get('/short-urls/my')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body = list.body as ShortUrlBody[];
    const mine = body.filter((entry) => entry.userId === loginUserId);
    expect(mine.length).toBeGreaterThan(0);

    const updatedUrl = `${originalUrl}/updated`;
    const res = await request(app.getHttpServer())
      .patch(`/short-urls/${mine[0].id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ originalUrl: updatedUrl })
      .expect(200);

    const patched = res.body as ShortUrlBody;
    expect(patched.originalUrl).toBe(updatedUrl);
  });

  it('DELETE /short-urls/:id rejects a missing token', async () => {
    const list = await request(app.getHttpServer())
      .get('/short-urls/my')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body = list.body as ShortUrlBody[];
    const item = body.find((entry) => entry.shortCode === shortCode);

    await request(app.getHttpServer())
      .delete(`/short-urls/${item!.id}`)
      .expect(401);
  });

  it('DELETE /short-urls/:id rejects a non-owner', async () => {
    const list = await request(app.getHttpServer())
      .get('/short-urls/my')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body = list.body as ShortUrlBody[];
    const item = body.find((entry) => entry.shortCode === shortCode);
    expect(item?.userId).toBe(loginUserId);

    await request(app.getHttpServer())
      .delete(`/short-urls/${item!.id}`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .expect(403);
  });

  it('DELETE /short-urls/:id removes the short url owned by the user', async () => {
    const list = await request(app.getHttpServer())
      .get('/short-urls/my')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body = list.body as ShortUrlBody[];
    const mine = body.filter((entry) => entry.userId === loginUserId);
    expect(mine.length).toBeGreaterThan(0);

    const target = mine[0];
    await request(app.getHttpServer())
      .delete(`/short-urls/${target.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/short-urls/${target.shortCode}`)
      .expect(404);
  });
});
