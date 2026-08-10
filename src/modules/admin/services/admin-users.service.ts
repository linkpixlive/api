import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { VerifyUserDto } from '../dto/verify-user.dto';

@Injectable()
export class AdminUsersService {
  constructor(private usersRepository: UsersRepository) {}

  async verifyUser(userId: string, verifyUserDto: VerifyUserDto) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const updatedUser = await this.usersRepository.update(userId, {
      verified: verifyUserDto.verified,
    });

    return { verified: updatedUser.verified };
  }
}
