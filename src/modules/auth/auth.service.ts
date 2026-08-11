import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { JwtPayload } from '../../models/jwt-payload';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { UserService } from '../user/user.service';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: CreateUserDto): Promise<UserResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.userService.create(dto.email, passwordHash);
    return this.userService.toResponse(user);
  }

  async signIn(
    email: string,
    password: string,
  ): Promise<{ access_token: string }> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException();
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException();
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return { access_token: await this.jwtService.signAsync(payload) };
  }
}
