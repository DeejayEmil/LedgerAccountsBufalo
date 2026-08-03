import { BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repo: Partial<Repository<User>>;

  const existingUser: User = {
    id: 'user-1',
    email: 'ana@example.com',
    passwordHash: 'hashed',
    fullName: 'Ana Pérez',
    role: UserRole.CUSTOMER,
    avatarUrl: null,
    accounts: [],
    createdAt: new Date(),
  };

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((v) => v),
      save: jest
        .fn()
        .mockImplementation((v) => Promise.resolve({ id: 'user-1', ...v })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    service = new UsersService(repo as Repository<User>);
  });

  it('crea un usuario nuevo con la contraseña hasheada (nunca en texto plano)', async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(null);

    const user = await service.create({
      email: 'nueva@example.com',
      password: 'Str0ngP@ssword',
      fullName: 'Nueva Persona',
    });

    expect(user.passwordHash).toBeDefined();
    expect(user.passwordHash).not.toBe('Str0ngP@ssword');
    expect(await bcrypt.compare('Str0ngP@ssword', user.passwordHash)).toBe(
      true,
    );
  });

  it('rechaza el registro si el email ya está en uso', async () => {
    (repo.findOne as jest.Mock).mockResolvedValue(existingUser);

    await expect(
      service.create({
        email: existingUser.email,
        password: 'x',
        fullName: 'y',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('valida correctamente la contraseña contra el hash almacenado', async () => {
    const passwordHash = await bcrypt.hash('correcta123', 12);
    const user = { ...existingUser, passwordHash };

    await expect(service.validatePassword(user, 'correcta123')).resolves.toBe(
      true,
    );
    await expect(service.validatePassword(user, 'incorrecta')).resolves.toBe(
      false,
    );
  });

  describe('updateAvatar', () => {
    it('actualiza el avatar si es un data URI de imagen válido', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue({
        ...existingUser,
        avatarUrl: 'data:image/jpeg;base64,AAAA',
      });

      const updated = await service.updateAvatar(
        'user-1',
        'data:image/jpeg;base64,AAAA',
      );

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'user-1' },
        { avatarUrl: 'data:image/jpeg;base64,AAAA' },
      );
      expect(updated.avatarUrl).toBe('data:image/jpeg;base64,AAAA');
    });

    it('rechaza valores que no son un data URI de imagen', async () => {
      await expect(
        service.updateAvatar('user-1', 'https://example.com/foto.jpg'),
      ).rejects.toThrow(BadRequestException);

      expect(repo.update).not.toHaveBeenCalled();
    });
  });
});
