import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { slugify } from '../common/slug';

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

  findByNameOrEmail(identifier: string): Promise<User | null> {
    return this.users.createQueryBuilder('user')
      .where('LOWER(user.name) LIKE :identifier', { identifier: `%${identifier}%` })
      .orWhere('LOWER(user.email) LIKE :identifier', { identifier: `%${identifier}%` })
      .getOne();
  }

  findByVerificationToken(token: string): Promise<User | null> {
    return this.users.findOne({ where: { verificationToken: token } });
  }

  list(): Promise<User[]> {
    return this.users.find({ order: { id: 'ASC' } });
  }

  async create(data: {
    email: string;
    name: string;
    password: string;
    roles?: string[];
    bio?: string | null;
    emailVerified?: boolean;
    verificationToken?: string | null;
  }): Promise<User> {
    const user = this.users.create({
      email: data.email,
      name: data.name,
      password: data.password,
      roles: data.roles ?? [],
      bio: data.bio ?? null,
      emailVerified: data.emailVerified ?? true,
      verificationToken: data.verificationToken ?? null,
    });
    return this.users.save(user);
  }

  async updateProfile(
    id: number,
    data: { name: string; email: string; bio: string | null },
  ): Promise<User | null> {
    const user = await this.findById(id);
    if (!user) {
      return null;
    }
    user.name = data.name;
    user.email = data.email;
    user.bio = data.bio;
    return this.users.save(user);
  }

  async updatePassword(id: number, password: string): Promise<void> {
    await this.users.update({ id }, { password });
  }

  async setVerificationToken(
    id: number,
    token: string | null,
  ): Promise<void> {
    await this.users.update({ id }, { verificationToken: token });
  }

  async markEmailVerified(id: number): Promise<void> {
    await this.users.update(
      { id },
      { emailVerified: true, verificationToken: null },
    );
  }

  save(user: User): Promise<User> {
    return this.users.save(user);
  }

  count(): Promise<number> {
    return this.users.count();
  }

  findBySlug(slug: string): Promise<User | null> {
    return this.users.findOne({
      where: { slug },
      relations: { posts: true },
    });
  }

  async updateAvatar(id: number, avatar: string): Promise<User | null> {
    const user = await this.findById(id);
    if (!user) {
      return null;
    }
    user.avatar = avatar;
    return this.users.save(user);
  }

  async ensureSlug(user: User): Promise<string> {
    if (!user.slug) {
      user.slug = await this.uniqueUserSlug(user.name, user.id);
      await this.users.save(user);
    }
    return user.slug;
  }

  async uniqueUserSlug(name: string, ignoreId?: number): Promise<string> {
    const base = slugify(name) || `user-${Date.now()}`;
    let slug = base;
    let suffix = 2;
    while (true) {
      const where: Record<string, unknown> = { slug };
      if (ignoreId) {
        where.id = Not(ignoreId);
      }
      const count = await this.users.count({ where });
      if (count === 0) {
        return slug;
      }
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
  }
}
