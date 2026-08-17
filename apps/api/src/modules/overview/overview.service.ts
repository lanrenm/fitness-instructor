import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database';

@Injectable()
export class OverviewService {
  constructor(private db: DatabaseService) {}

  async getStats(userId: string) {
    const result = await this.db.query(
      `SELECT
        COUNT(*) FILTER (WHERE "startedAt" >= date_trunc('week', NOW())) AS "thisWeekCount",
        COALESCE(SUM("durationMinutes") FILTER (WHERE "startedAt" >= date_trunc('week', NOW())), 0)::int AS "thisWeekDuration",
        COALESCE(SUM("caloriesBurned") FILTER (WHERE "startedAt" >= date_trunc('week', NOW())), 0)::int AS "thisWeekKcal",
        COUNT(*) AS "totalCount",
        COUNT(*) FILTER (WHERE "startedAt" >= date_trunc('week', NOW()) - INTERVAL '7 days'
                         AND "startedAt" <  date_trunc('week', NOW())) AS "lastWeekCount",
        COALESCE(SUM("durationMinutes") FILTER (WHERE "startedAt" >= date_trunc('week', NOW()) - INTERVAL '7 days'
                         AND "startedAt" <  date_trunc('week', NOW())), 0)::int AS "lastWeekDuration",
        COALESCE(SUM("caloriesBurned") FILTER (WHERE "startedAt" >= date_trunc('week', NOW()) - INTERVAL '7 days'
                         AND "startedAt" <  date_trunc('week', NOW())), 0)::int AS "lastWeekKcal"
      FROM "TrainingSession"
      WHERE "userId" = $1`,
      [userId],
    );

    const row = result.rows[0];
    return {
      thisWeek: {
        count: Number(row.thisWeekCount),
        durationMinutes: row.thisWeekDuration,
        caloriesBurned: row.thisWeekKcal,
      },
      total: {
        count: Number(row.totalCount),
      },
      lastWeek: {
        count: Number(row.lastWeekCount),
        durationMinutes: row.lastWeekDuration,
        caloriesBurned: row.lastWeekKcal,
      },
    };
  }

  async getIntensity(userId: string) {
    const result = await this.db.query(
      `SELECT
        EXTRACT(ISODOW FROM d.date)::int AS weekday,
        to_char(d.date, 'YYYY-MM-DD') AS date,
        COALESCE(AVG(ts.intensity), 0)::int AS intensity
      FROM generate_series(
        date_trunc('week', NOW())::date,
        date_trunc('week', NOW())::date + INTERVAL '6 days',
        INTERVAL '1 day'
      ) AS d(date)
      LEFT JOIN "TrainingSession" ts
        ON ts."userId" = $1
        AND ts."startedAt"::date = d.date
      GROUP BY d.date
      ORDER BY d.date`,
      [userId],
    );

    return { days: result.rows };
  }

  async getRecentSessions(userId: string, limit: number) {
    const result = await this.db.query(
      `SELECT id, "userId", name, "startedAt", "durationMinutes", "exerciseCount",
              intensity, "caloriesBurned", notes, "createdAt", "updatedAt"
      FROM "TrainingSession"
      WHERE "userId" = $1
      ORDER BY "startedAt" DESC
      LIMIT $2`,
      [userId, limit],
    );

    return result.rows;
  }
}
