import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database';
import { CreateExcerciseDto } from './dto/create-excercise.dto';
import { UpdateExcerciseDto } from './dto/update-excercise.dto';

const LIST_SQL = `
  SELECT e.id, e.name, e.description, e.category, e.difficulty, e.equipment,
         e."isActive", e."createdAt", e."updatedAt",
         COALESCE(
           json_agg(json_build_object('id', mg.id, 'name', mg.name)
                    ORDER BY mg.name)
           FILTER (WHERE mg.id IS NOT NULL), '[]'
         ) AS "targetMuscles"
  FROM "Excercises" e
  LEFT JOIN "ExcerciseMuscle" em ON em."excerciseId" = e.id
  LEFT JOIN "MuscleGroup" mg ON mg.id = em."muscleGroupId"
  GROUP BY e.id
  ORDER BY e."createdAt" ASC
`;

const FIND_ONE_SQL = `
  SELECT e.id, e.name, e.description, e.category, e.difficulty, e.equipment,
         e."isActive", e."createdAt", e."updatedAt",
         COALESCE(
           json_agg(json_build_object('id', mg.id, 'name', mg.name)
                    ORDER BY mg.name)
           FILTER (WHERE mg.id IS NOT NULL), '[]'
         ) AS "targetMuscles"
  FROM "Excercises" e
  LEFT JOIN "ExcerciseMuscle" em ON em."excerciseId" = e.id
  LEFT JOIN "MuscleGroup" mg ON mg.id = em."muscleGroupId"
  WHERE e.id = $1
  GROUP BY e.id
`;

@Injectable()
export class ExcercisesService {
  constructor(private db: DatabaseService) {}

  async findAll() {
    const r = await this.db.query(LIST_SQL);
    return r.rows;
  }

  async findOne(id: string) {
    const r = await this.db.query(FIND_ONE_SQL, [id]);
    if (r.rows.length === 0) throw new NotFoundException('动作不存在');
    return r.rows[0];
  }

  async create(dto: CreateExcerciseDto) {
    await this.assertMuscleGroupsExist(dto.muscleGroupIds);
    const client = await this.db.getPool().connect();
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO "Excercises" (id, name, description, category, difficulty, equipment, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, COALESCE($5::text[], '{}'), COALESCE($6::boolean, true), NOW(), NOW())
         RETURNING id`,
        [
          dto.name,
          dto.description ?? null,
          dto.category,
          dto.difficulty,
          dto.equipment ?? null,
          dto.isActive ?? null,
        ],
      );
      const newId: string = ins.rows[0].id;
      for (const mgId of dto.muscleGroupIds) {
        await client.query(
          `INSERT INTO "ExcerciseMuscle" (id, "excerciseId", "muscleGroupId", weight, "isPrimary", "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2, 0, false, NOW())`,
          [newId, mgId],
        );
      }
      await client.query('COMMIT');
      return this.findOne(newId);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async update(id: string, dto: UpdateExcerciseDto) {
    await this.assertExists(id);
    if (dto.muscleGroupIds !== undefined) {
      await this.assertMuscleGroupsExist(dto.muscleGroupIds);
    }
    const client = await this.db.getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE "Excercises"
         SET name = COALESCE($2, name),
             description = CASE WHEN $3::boolean THEN $4 ELSE description END,
             category = COALESCE($5, category),
             difficulty = COALESCE($6, difficulty),
             equipment = CASE WHEN $7::boolean THEN $8 ELSE equipment END,
             "isActive" = COALESCE($9, "isActive"),
             "updatedAt" = NOW()
         WHERE id = $1`,
        [
          id,
          dto.name ?? null,
          dto.description !== undefined,
          dto.description ?? null,
          dto.category ?? null,
          dto.difficulty ?? null,
          dto.equipment !== undefined,
          dto.equipment ?? null,
          dto.isActive ?? null,
        ],
      );
      if (dto.muscleGroupIds !== undefined) {
        await client.query(
          `DELETE FROM "ExcerciseMuscle" WHERE "excerciseId" = $1`,
          [id],
        );
        for (const mgId of dto.muscleGroupIds) {
          await client.query(
            `INSERT INTO "ExcerciseMuscle" (id, "excerciseId", "muscleGroupId", weight, "isPrimary", "createdAt")
             VALUES (gen_random_uuid()::text, $1, $2, 0, false, NOW())`,
            [id, mgId],
          );
        }
      }
      await client.query('COMMIT');
      return this.findOne(id);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    // FK ON DELETE CASCADE handles ExcerciseMuscle rows automatically.
    await this.db.query(`DELETE FROM "Excercises" WHERE id = $1`, [id]);
  }

  private async assertExists(id: string) {
    const r = await this.db.query(
      `SELECT 1 FROM "Excercises" WHERE id = $1`,
      [id],
    );
    if (r.rows.length === 0) throw new NotFoundException('动作不存在');
  }

  private async assertMuscleGroupsExist(ids: string[]) {
    const r = await this.db.query(
      `SELECT id FROM "MuscleGroup" WHERE id = ANY($1::text[])`,
      [ids],
    );
    if (r.rows.length !== ids.length) {
      const found = new Set(r.rows.map((row) => row.id as string));
      const missing = ids.filter((id) => !found.has(id));
      throw new BadRequestException(
        `肌群不存在: ${missing.join(', ')}`,
      );
    }
  }
}
