import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findById(id: number): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email } });
  }

  async create(data: {
    email: string;
    name: string;
    password: string;
    roles?: string[];
  }): Promise<User> {
    const user = this.users.create({
      email: data.email,
      name: data.name,
      password: data.password,
      roles: data.roles ?? [],
    });
    return this.users.save(user);
  }

  count(): Promise<number> {
    return this.users.count();
  }
}
