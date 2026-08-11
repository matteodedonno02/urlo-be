import { UserRole } from '../../../models/user-role.enum';

export class UserResponseDto {
  id!: string;
  email!: string;
  role!: UserRole;
  createdAt!: Date;
  updatedAt!: Date;
}
