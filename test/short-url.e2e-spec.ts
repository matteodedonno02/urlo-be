import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface ShortUrlBody {
  id: string;
  shortCode: string;
  originalUrl: string;
  visitCount: number;
}

describe('ShortUrl (e2e)', () => {
  let app: INestApplication<App>;
  let shortCode = '';

  const originalUrl = 'https://example.com/path';

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

  it('POST /short-urls creates a short url with an auto-generated shortCode', async () => {
    const res = await request(app.getHttpServer())
      .post('/short-urls')
      .send({ originalUrl })
      .expect(201);

    const body = res.body as ShortUrlBody;
    shortCode = body.shortCode;
    expect(body.shortCode).toHaveLength(6);
    expect(body.originalUrl).toBe(originalUrl);
    expect(body.visitCount).toBe(0);
    expect(body.id).toBeDefined();
  });

  it('POST /short-urls rejects an invalid URL', async () => {
    await request(app.getHttpServer())
      .post('/short-urls')
      .send({ originalUrl: 'not a valid url' })
      .expect(400);
  });

  it('POST /short-urls rejects an unknown property', async () => {
    await request(app.getHttpServer())
      .post('/short-urls')
      .send({ originalUrl, shortCode: 'abc123' })
      .expect(400);
  });

  it('GET /short-urls lists short urls', async () => {
    const res = await request(app.getHttpServer())
      .get('/short-urls')
      .expect(200);

    const body = res.body as ShortUrlBody[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((item) => item.shortCode === shortCode)).toBe(true);
  });

  it('GET /short-urls/:shortCode redirects to the original URL', async () => {
    const res = await request(app.getHttpServer())
      .get(`/short-urls/${shortCode}`)
      .expect(302);

    expect(res.headers.location).toBe(originalUrl);
  });

  it('GET /short-urls/:shortCode increments the visit count', async () => {
    const res = await request(app.getHttpServer())
      .get('/short-urls')
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

  it('PATCH /short-urls/:id updates the short url', async () => {
    const list = await request(app.getHttpServer())
      .get('/short-urls')
      .expect(200);
    const body = list.body as ShortUrlBody[];
    const item = body.find((entry) => entry.shortCode === shortCode);
    expect(item).toBeDefined();

    const updatedUrl = `${originalUrl}/updated`;
    const res = await request(app.getHttpServer())
      .patch(`/short-urls/${item!.id}`)
      .send({ originalUrl: updatedUrl })
      .expect(200);

    const patched = res.body as ShortUrlBody;
    expect(patched.originalUrl).toBe(updatedUrl);
  });

  it('DELETE /short-urls/:id removes the short url', async () => {
    const list = await request(app.getHttpServer())
      .get('/short-urls')
      .expect(200);
    const body = list.body as ShortUrlBody[];
    const item = body.find((entry) => entry.shortCode === shortCode);
    expect(item).toBeDefined();

    await request(app.getHttpServer())
      .delete(`/short-urls/${item!.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/short-urls/${shortCode}`)
      .expect(404);
  });
});
