import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { UpdateUserFeeDto } from '../dto/update-user-fee.dto';
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

  async updateUserFee(userId: string, updateUserFeeDto: UpdateUserFeeDto) {
    if (updateUserFeeDto.withdrawalFeePercentage === undefined) {
      throw new BadRequestException(
        'withdrawalFeePercentage é obrigatório: número entre 0 e 100, ou null para voltar à taxa global.',
      );
    }

    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const updatedUser = await this.usersRepository.update(userId, {
      withdrawalFeePercentage: updateUserFeeDto.withdrawalFeePercentage,
    });

    return {
      withdrawalFeePercentage:
        updatedUser.withdrawalFeePercentage != null
          ? Number(updatedUser.withdrawalFeePercentage)
          : null,
    };
  }
}
