import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database';
import { EmbeddingsService } from '../ai/embeddings.service';

interface ITrainingSessionCreateInput {
  name: string;
  startedAt: string | Date;
  durationMinutes: number;
  exerciseCount: number;
  intensity: number;
  caloriesBurned: number;
  notes?: string | null;
}

@Injectable()
export class TrainingSessionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async create(userId: string, input: ITrainingSessionCreateInput) {
    const { rows } = await this.db.getPool().query(
      `INSERT INTO "TrainingSession"(id, "userId", name, "startedAt", "durationMinutes", "exerciseCount", intensity, "caloriesBurned", notes, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id`,
      [
        userId,
        input.name,
        input.startedAt,
        input.durationMinutes,
        input.exerciseCount,
        input.intensity,
        input.caloriesBurned,
        input.notes ?? null,
      ],
    );
    const id = rows[0].id;
    await this.embeddings
      .upsert('training_session', id, `${input.name}\n${input.notes ?? ''}`.trim())
      .catch(() => undefined);
    return { id };
  }

  async list(userId: string, limit = 50) {
    const { rows } = await this.db
      .getPool()
      .query(
        `SELECT * FROM "TrainingSession" WHERE "userId" = $1 ORDER BY "startedAt" DESC LIMIT $2`,
        [userId, limit],
      );
    return rows;
  }

  async findById(userId: string, id: string) {
    const { rows } = await this.db
      .getPool()
      .query(`SELECT * FROM "TrainingSession" WHERE id = $1 AND "userId" = $2`, [id, userId]);
    return rows[0] ?? null;
  }

  async update(userId: string, id: string, patch: Partial<ITrainingSessionCreateInput>) {
    const sets: string[] = [];
    const args: any[] = [];
    let i = 1;
    const fields: (keyof ITrainingSessionCreateInput)[] = [
      'name',
      'startedAt',
      'durationMinutes',
      'exerciseCount',
      'intensity',
      'caloriesBurned',
      'notes',
    ];
    for (const f of fields) {
      if (patch[f] !== undefined) {
        sets.push(`"${f}" = $${i++}`);
        args.push(patch[f] as any);
      }
    }
    if (sets.length) {
      sets.push(`"updatedAt" = NOW()`);
      args.push(id, userId);
      await this.db
        .getPool()
        .query(
          `UPDATE "TrainingSession" SET ${sets.join(', ')} WHERE id = $${i++} AND "userId" = $${i}`,
          args,
        );

      const next = await this.findById(userId, id);
      if (next && (patch.name !== undefined || patch.notes !== undefined)) {
        await this.embeddings
          .upsert('training_session', id, `${next.name}\n${next.notes ?? ''}`.trim())
          .catch(() => undefined);
      }
      return next;
    }
    return this.findById(userId, id);
  }

  async remove(userId: string, id: string) {
    const r = await this.db
      .getPool()
      .query(`DELETE FROM "TrainingSession" WHERE id = $1 AND "userId" = $2`, [id, userId]);
    if ((r.rowCount ?? 0) > 0) {
      await this.embeddings.remove('training_session', id).catch(() => undefined);
      return true;
    }
    return false;
  }
}
