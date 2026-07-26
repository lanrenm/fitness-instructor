import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://fitness:fitness0520@postgres:5432/fitness_instructor?schema=public',
  }),
});

const DEMO_PHONE = '13800138000';
const DEMO_PASS = 'Test1234!';
const DEMO_NAME = '演示账号';

// 本周 = 距离今天最近的周一（含今天）至下周一
// 上周 = 本周 -7 天 ~ 本周
function startOfThisWeek(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diffToMon = (day + 6) % 7; // 周一=0
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() - diffToMon);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function dayOffset(base: Date, offset: number, hour: number, minute: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  // 1. upsert 演示用户
  const hashed = await hashPassword(DEMO_PASS);
  const user = await prisma.user.upsert({
    where: { phonenumber: DEMO_PHONE },
    update: { name: DEMO_NAME },
    create: {
      email: `${DEMO_PHONE}@phone.local`,
      phonenumber: DEMO_PHONE,
      password: hashed,
      name: DEMO_NAME,
    },
  });

  // 2. 幂等：清掉该用户已有 TrainingSession
  await prisma.trainingSession.deleteMany({ where: { userId: user.id } });

  // 3. 插数据
  const weekStart = startOfThisWeek();
  // 本周 weekday offset: 周一=0, 周二=1, 周三=2, 周五=4
  // 上周 offset: 周一=-7, 周三=-5, 周六=-2
  const sessions = [
    { offset: 0, hour: 18, minute: 30, name: '胸部+三头训练', duration: 75, count: 8, intensity: 85, kcal: 420 },
    { offset: 1, hour: 19, minute: 0, name: '背部+二头训练', duration: 80, count: 10, intensity: 60, kcal: 460 },
    { offset: 2, hour: 14, minute: 30, name: '腿+核心训练', duration: 90, count: 12, intensity: 90, kcal: 500 },
    { offset: 4, hour: 10, minute: 0, name: '腿部训练日', duration: 65, count: 6, intensity: 75, kcal: 380 },
    // 上周
    { offset: -7, hour: 18, minute: 0, name: '推力训练', duration: 70, count: 7, intensity: 70, kcal: 400 },
    { offset: -5, hour: 19, minute: 30, name: '拉力训练', duration: 75, count: 9, intensity: 65, kcal: 430 },
    { offset: -2, hour: 10, minute: 0, name: '腿部训练日', duration: 65, count: 6, intensity: 50, kcal: 360 },
  ];

  await prisma.trainingSession.createMany({
    data: sessions.map((s) => ({
      userId: user.id,
      name: s.name,
      startedAt: dayOffset(weekStart, s.offset, s.hour, s.minute),
      durationMinutes: s.duration,
      exerciseCount: s.count,
      intensity: s.intensity,
      caloriesBurned: s.kcal,
    })),
  });

  // 4. 幂等 upsert 一级肌群（设计稿 4 个动作所需）
  const muscleGroups = [
    { name: '胸大肌', description: '胸部主要肌群' },
    { name: '背阔肌', description: '背部主要肌群' },
    { name: '股四头肌', description: '大腿前侧肌群' },
    { name: '臀大肌', description: '臀部主要肌群' },
    { name: '三角肌', description: '肩部肌群' },
    { name: '肱二头肌', description: '上臂前侧肌群' },
    { name: '腹直肌', description: '腹部核心肌群' },
    { name: '竖脊肌', description: '背部深层肌群，维持脊柱稳定' },
    { name: '腘绳肌', description: '大腿后侧肌群' },
  ];
  const muscleGroupByName = new Map<string, string>();
  for (const mg of muscleGroups) {
    const row = await prisma.muscleGroup.upsert({
      where: { id: `seed-muscle-${mg.name}` },
      update: { description: mg.description, isActive: true },
      create: {
        id: `seed-muscle-${mg.name}`,
        name: mg.name,
        description: mg.description,
        isActive: true,
      },
    });
    muscleGroupByName.set(mg.name, row.id);
  }

  // 5. 幂等 upsert 设计稿 4 个动作
  const exercises = [
    { name: '杠铃深蹲', category: 3, difficulty: 2, equipment: ['杠铃'],
      muscles: ['股四头肌', '臀大肌'] },
    { name: '卧推',     category: 1, difficulty: 2, equipment: ['杠铃'],
      muscles: ['胸大肌', '三角肌'] },
    { name: '硬拉',     category: 2, difficulty: 3, equipment: ['杠铃'],
      muscles: ['竖脊肌', '臀大肌', '腘绳肌'] },
    { name: '引体向上', category: 2, difficulty: 2, equipment: ['单杠'],
      muscles: ['背阔肌', '肱二头肌'] },
  ];
  for (const ex of exercises) {
    const existing = await prisma.excercises.findFirst({ where: { name: ex.name } });
    let exerciseId: string;
    if (existing) {
      exerciseId = existing.id;
      await prisma.excercises.update({
        where: { id: existing.id },
        data: {
          category: ex.category,
          difficulty: ex.difficulty,
          equipment: ex.equipment,
        },
      });
      await prisma.excerciseMuscle.deleteMany({ where: { excerciseId: existing.id } });
    } else {
      const created = await prisma.excercises.create({
        data: {
          name: ex.name,
          category: ex.category,
          difficulty: ex.difficulty,
          equipment: ex.equipment,
        },
      });
      exerciseId = created.id;
    }
    for (const muscleName of ex.muscles) {
      const mgId = muscleGroupByName.get(muscleName);
      if (!mgId) continue;
      await prisma.excerciseMuscle.create({
        data: {
          excerciseId: exerciseId,
          muscleGroupId: mgId,
          weight: 0,
          isPrimary: false,
        },
      });
    }
  }

  const muscleCount = await prisma.muscleGroup.count();
  const exerciseCount = await prisma.excercises.count();
  console.log(`[seed] muscleGroups=${muscleCount}, exercises=${exerciseCount}`);

  const count = await prisma.trainingSession.count({ where: { userId: user.id } });
  console.log(`[seed] user ${DEMO_PHONE} has ${count} TrainingSessions`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());