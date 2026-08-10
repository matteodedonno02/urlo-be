import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async create(email: string, passwordHash: string): Promise<User> {
    const existing = await this.repository.findOneBy({ email });
    if (existing) {
      throw new ConflictException(`Email "${email}" is already registered`);
    }

    const entity = this.repository.create({ email, passwordHash });

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

  toResponse(entity: User): UserResponseDto {
    return {
      id: entity.id,
      email: entity.email,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
