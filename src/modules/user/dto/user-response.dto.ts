import { UserRole } from '../../../models/user-role.enum';

export class UserResponseDto {
  id!: string;
  email!: string;
  role!: UserRole;
  mustChangePassword!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
