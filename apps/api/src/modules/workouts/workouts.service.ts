import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database';
import { EmbeddingsService } from '../ai/embeddings.service';

interface IWorkoutCreateInput {
  name: string;
  description?: string | null;
  workoutExcerciseIds?: string[];
}

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async create(userId: string, input: IWorkoutCreateInput) {
    const client = await this.db.getPool().connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO "Workout"(id, name, description, "userId", "isPublic")
         VALUES (gen_random_uuid()::text, $1, $2, $3, false) RETURNING id`,
        [input.name, input.description ?? null, userId],
      );
      const id = rows[0].id;
      for (let i = 0; i < (input.workoutExcerciseIds ?? []).length; i++) {
        await client.query(
          `INSERT INTO "WorkoutExcercises"(id, "workoutId", "excerciseId", "orderIndex")
           VALUES (gen_random_uuid()::text, $1, $2, $3)`,
          [id, input.workoutExcerciseIds![i], i],
        );
      }
      await client.query('COMMIT');

      await this.embeddings
        .upsert('workout', id, `${input.name}\n${input.description ?? ''}`.trim())
        .catch(() => undefined);

      return { id };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async findById(id: string) {
    const { rows } = await this.db.getPool().query(`SELECT * FROM "Workout" WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async list(userId: string) {
    const { rows } = await this.db.getPool().query(
      `SELECT * FROM "Workout" WHERE "userId" = $1 OR "isPublic" = true ORDER BY "createdAt" DESC`,
      [userId],
    );
    return rows;
  }

  async update(userId: string, id: string, patch: Partial<IWorkoutCreateInput>) {
    const owned = await this.findById(id);
    if (!owned || owned.userId !== userId) {
      throw new Error('workout not found');
    }
    const sets: string[] = [];
    const args: any[] = [];
    let i = 1;
    if (patch.name !== undefined) {
      sets.push(`name = $${i++}`);
      args.push(patch.name);
    }
    if (patch.description !== undefined) {
      sets.push(`description = $${i++}`);
      args.push(patch.description);
    }
    if (sets.length) {
      sets.push(`"updatedAt" = NOW()`);
      args.push(id);
      await this.db.getPool().query(`UPDATE "Workout" SET ${sets.join(', ')} WHERE id = $${i}`, args);
    }
    await this.embeddings
      .upsert(
        'workout',
        id,
        `${patch.name ?? owned.name}\n${patch.description ?? owned.description ?? ''}`.trim(),
      )
      .catch(() => undefined);
    return this.findById(id);
  }

  async remove(userId: string, id: string) {
    const owned = await this.findById(id);
    if (!owned || owned.userId !== userId) return false;
    await this.db.getPool().query(`DELETE FROM "Workout" WHERE id = $1`, [id]);
    await this.embeddings.remove('workout', id).catch(() => undefined);
    return true;
  }
}