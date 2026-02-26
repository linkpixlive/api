import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/db/prisma.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  create(createAuthDto: CreateAuthDto) {
    return 'This action adds a new auth';
  }

  findAll() {
    return `This action returns all auth`;
  }

  async findOne(id: number) {
    const created = await this.prisma.user.create({
      data: {
        name: 'Novo',
        email: 'novo@email.com',
        username: 'novo',
        password: '[PASSWORD]',
      },
    });

    console.log(created);

    return created;

    // return `This action returns a #${id} auth`;
  }

  update(id: number, updateAuthDto: UpdateAuthDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
