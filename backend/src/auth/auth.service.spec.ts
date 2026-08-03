import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Partial<UsersService>;
  let jwtService: Partial<JwtService>;

  const user: User = {
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
    usersService = {
      create: jest.fn().mockResolvedValue(user),
      findByEmail: jest.fn(),
      validatePassword: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
    };
    service = new AuthService(
      usersService as UsersService,
      jwtService as JwtService,
    );
  });

  it('register: crea el usuario y devuelve un access token + datos públicos', async () => {
    const result = await service.register({
      email: user.email,
      password: 'Str0ngP@ssword',
      fullName: user.fullName,
    });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user).toEqual({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: null,
    });
    // El hash de contraseña nunca debe filtrarse en la respuesta.
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('login: rechaza si el email no existe', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

    await expect(service.login('no-existe@example.com', 'x')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('login: rechaza si la contraseña es incorrecta', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(user);
    (usersService.validatePassword as jest.Mock).mockResolvedValue(false);

    await expect(service.login(user.email, 'incorrecta')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('login: devuelve token si las credenciales son correctas', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(user);
    (usersService.validatePassword as jest.Mock).mockResolvedValue(true);

    const result = await service.login(user.email, 'correcta');

    expect(result.accessToken).toBe('signed.jwt.token');
  });
});
