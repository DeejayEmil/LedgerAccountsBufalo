import { state } from './e2e-pg-instance';

export default async function globalTeardown(): Promise<void> {
  if (state.pg) {
    await state.pg.stop();
  }
}
