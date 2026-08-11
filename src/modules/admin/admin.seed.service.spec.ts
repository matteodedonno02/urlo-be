import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../models/user-role.enum';
import { UserService } from '../user/user.service';
import { AdminSeedService } from './admin.seed.service';

describe('AdminSeedService', () => {
  let service: AdminSeedService;
  let userService: jest.Mocked<Pick<UserService, 'findByEmail' | 'create'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  const config = (email?: string, password?: string) =>
    ((key: string): unknown =>
      key === 'admin.email' ? email : password) as jest.Mock;

  beforeEach(async () => {
    userService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    configService = { get: jest.fn() };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSeedService,
        { provide: ConfigService, useValue: configService },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = app.get<AdminSeedService>(AdminSeedService);
  });

  it('should create the admin with a hashed password when the email does not exist', async () => {
    configService.get.mockImplementation(
      config('admin@urlo.local', 'initial-password'),
    );
    userService.findByEmail.mockResolvedValue(null);
    userService.create.mockResolvedValue({ id: 'new-id' } as never);

    await service.onApplicationBootstrap();

    expect(userService.findByEmail).toHaveBeenCalledWith('admin@urlo.local');
    expect(userService.create).toHaveBeenCalledWith(
      'admin@urlo.local',
      expect.any(String),
      UserRole.ADMIN,
      true,
    );
    const hashed = (
      userService.create.mock.calls[0] as [string, string, UserRole]
    )[1];
    expect(hashed).not.toBe('initial-password');
  });

  it('should not create the admin when the email already exists', async () => {
    configService.get.mockImplementation(
      config('admin@urlo.local', 'initial-password'),
    );
    userService.findByEmail.mockResolvedValue({ id: 'existing' } as never);

    await service.onApplicationBootstrap();

    expect(userService.create).not.toHaveBeenCalled();
  });

  it('should skip when the admin config is missing', async () => {
    configService.get.mockReturnValue(undefined);

    await service.onApplicationBootstrap();

    expect(userService.findByEmail).not.toHaveBeenCalled();
    expect(userService.create).not.toHaveBeenCalled();
  });
});
