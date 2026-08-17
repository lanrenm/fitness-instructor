import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database';
import { EmbeddingsService } from '../ai/embeddings.service';
import { AI_RAG_OWNER_TYPE } from '@fitness/shared-types/ai';
import { CreateMuscleGroupDto } from './dto/create-muscle-group.dto';
import { UpdateMuscleGroupDto } from './dto/update-muscle-group.dto';

const LIST_SQL = `
  SELECT mg.id, mg.name, mg.description, mg."parentId", mg."isActive",
         mg."createdAt", mg."updatedAt",
         COUNT(em.id)::int AS "exerciseCount"
  FROM "MuscleGroup" mg
  LEFT JOIN "ExcerciseMuscle" em ON em."muscleGroupId" = mg.id
  GROUP BY mg.id
  ORDER BY mg."createdAt" ASC
`;

const FIND_ONE_SQL = `
  SELECT mg.id, mg.name, mg.description, mg."parentId", mg."isActive",
         mg."createdAt", mg."updatedAt",
         COUNT(em.id)::int AS "exerciseCount"
  FROM "MuscleGroup" mg
  LEFT JOIN "ExcerciseMuscle" em ON em."muscleGroupId" = mg.id
  WHERE mg.id = $1
  GROUP BY mg.id
`;

@Injectable()
export class MuscleGroupsService {
  constructor(
    private db: DatabaseService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async findAll() {
    const r = await this.db.query(LIST_SQL);
    return r.rows;
  }

  async findOne(id: string) {
    const r = await this.db.query(FIND_ONE_SQL, [id]);
    if (r.rows.length === 0) throw new NotFoundException('肌肉群不存在');
    return r.rows[0];
  }

  async create(dto: CreateMuscleGroupDto) {
    const parentId = dto.parentId ? dto.parentId : null;
    if (parentId) {
      await this.assertExists(parentId);
    }
    const r = await this.db.query(
      `INSERT INTO "MuscleGroup" (id, name, description, "parentId", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, COALESCE($4, true), NOW(), NOW())
       RETURNING id, name, description, "parentId", "isActive", "createdAt", "updatedAt"`,
      [dto.name, dto.description ?? null, parentId, dto.isActive ?? null],
    );
    return this.embedAndReturn(r.rows[0].id);
  }

  async update(id: string, dto: UpdateMuscleGroupDto) {
    await this.assertExists(id);
    let newParent: string | null | undefined;
    if (dto.parentId !== undefined) {
      newParent = dto.parentId ? dto.parentId : null;
      if (newParent === id) {
        throw new BadRequestException('不能把自己设为父级');
      }
      if (newParent) {
        await this.assertExists(newParent);
        const cycle = await this.db.query(
          `WITH RECURSIVE descendants AS (
             SELECT id FROM "MuscleGroup" WHERE "parentId" = $1
             UNION ALL
             SELECT mg.id FROM "MuscleGroup" mg JOIN descendants d ON mg."parentId" = d.id
           )
           SELECT EXISTS(SELECT 1 FROM descendants WHERE id = $2) AS would_cycle`,
          [id, newParent],
        );
        if (cycle.rows[0].would_cycle) {
          throw new BadRequestException('不能把肌肉群移到其后代下');
        }
      }
    }
    await this.db.query(
      `UPDATE "MuscleGroup"
       SET name = COALESCE($2, name),
           description = CASE WHEN $3::boolean THEN $4 ELSE description END,
           "parentId" = CASE WHEN $5::boolean THEN $6 ELSE "parentId" END,
           "isActive" = COALESCE($7, "isActive"),
           "updatedAt" = NOW()
       WHERE id = $1`,
      [
        id,
        dto.name ?? null,
        dto.description !== undefined,
        dto.description ?? null,
        newParent !== undefined,
        newParent ?? null,
        dto.isActive ?? null,
      ],
    );
    return this.embedAndReturn(id);
  }

  async remove(id: string) {
    await this.assertExists(id);
    const ref = await this.db.query(
      `SELECT COUNT(*)::int AS cnt FROM "ExcerciseMuscle" WHERE "muscleGroupId" = $1`,
      [id],
    );
    const cnt = ref.rows[0].cnt;
    if (cnt > 0) {
      throw new ConflictException(`该肌群仍被 ${cnt} 个动作引用，无法删除`);
    }
    await this.db.query(`DELETE FROM "MuscleGroup" WHERE id = $1`, [id]);
    await this.embeddings
      .remove(AI_RAG_OWNER_TYPE.MUSCLE_GROUP, id)
      .catch(() => undefined);
  }

  private async embedAndReturn(id: string) {
    const row = await this.findOne(id);
    await this.embeddings
      .upsert(
        AI_RAG_OWNER_TYPE.MUSCLE_GROUP,
        id,
        `${row.name}\n${row.description ?? ''}`.trim(),
      )
      .catch(() => undefined);
    return row;
  }

  private async assertExists(id: string) {
    const r = await this.db.query(`SELECT 1 FROM "MuscleGroup" WHERE id = $1`, [id]);
    if (r.rows.length === 0) throw new NotFoundException('肌肉群不存在');
  }
}