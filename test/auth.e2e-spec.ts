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
  createdAt: string;
  updatedAt: string;
}

interface LoginBody {
  access_token: string;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'dev';
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
});
