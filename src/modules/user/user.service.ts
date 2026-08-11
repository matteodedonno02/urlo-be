import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../models/user-role.enum';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async create(
    email: string,
    passwordHash: string,
    role: UserRole = UserRole.STANDARD,
    mustChangePassword = false,
  ): Promise<User> {
    const existing = await this.repository.findOneBy({ email });
    if (existing) {
      throw new ConflictException(`Email "${email}" is already registered`);
    }

    const entity = this.repository.create({
      email,
      passwordHash,
      role,
      mustChangePassword,
    });

    try {
      return await this.repository.save(entity);
    } catch {
      throw new ConflictException(`Email "${email}" is already registered`);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOneBy({ email });
  }

  async findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.repository.update(id, {
      passwordHash,
      mustChangePassword: false,
    });
  }

  async findAll(): Promise<UserResponseDto[]> {
    const entities = await this.repository.find({
      order: { createdAt: 'DESC' },
    });
    return entities.map((entity) => this.toResponse(entity));
  }

  toResponse(entity: User): UserResponseDto {
    return {
      id: entity.id,
      email: entity.email,
      role: entity.role,
      mustChangePassword: entity.mustChangePassword,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
