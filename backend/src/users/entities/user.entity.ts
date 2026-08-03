import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  // Nunca se expone en las respuestas de la API (ver UserPublic / DTOs).
  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  // Se guarda como data URI (base64) directamente en la fila: suficiente
  // para esta prueba. En un sistema real esto viviría en un bucket de
  // object storage (S3/GCS) y aquí solo se guardaría la URL pública.
  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  @OneToMany(() => Account, (account) => account.owner)
  accounts: Account[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
