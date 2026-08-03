import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';

const SALT_ROUNDS = 12;
// Límite generoso para una foto de perfil codificada en base64 (~3.5MB
// binarios). Evita que alguien mande archivos enormes al campo de texto.
const MAX_AVATAR_DATA_URI_LENGTH = 5_000_000;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(params: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<User> {
    const existing = await this.findByEmail(params.email);
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con este email');
    }

    const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);

    const user = this.usersRepository.create({
      email: params.email,
      passwordHash,
      fullName: params.fullName,
    });

    return this.usersRepository.save(user);
  }

  async validatePassword(user: User, plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, user.passwordHash);
  }

  async updateAvatar(userId: string, avatarDataUri: string): Promise<User> {
    if (!avatarDataUri.startsWith('data:image/')) {
      throw new BadRequestException(
        'avatarUrl debe ser un data URI de imagen, ej. "data:image/jpeg;base64,..."',
      );
    }
    if (avatarDataUri.length > MAX_AVATAR_DATA_URI_LENGTH) {
      throw new BadRequestException('La imagen es demasiado grande');
    }

    await this.usersRepository.update(
      { id: userId },
      { avatarUrl: avatarDataUri },
    );
    const updated = await this.findById(userId);
    if (!updated) {
      throw new BadRequestException('Usuario no encontrado');
    }
    return updated;
  }
}
