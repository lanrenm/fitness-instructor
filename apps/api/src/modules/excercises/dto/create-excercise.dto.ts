import { IsString, MinLength, isNumber } from 'class-validator';

export class CreateExcerciseDto {
  @IsString()
  @MinLength(2, { message: '名称至少需要2个字符' })
  name: string;

  @IsString()
  description: string;

  @isNumber()
  difficulty: number;

  @isNumber()
  category: number;
  // category          Int                 @default(1) // 动作所属类别：1=基础、2=力量、3=有氧、4=柔韧、5=平衡、6=爆发力
  // difficulty        Int                 @default(1) // 难度等级：1=初学者、2=中级、3=高级、4=专业级
  // targetMuscles     String[] // 目标肌群列表，如["胸肌", "三头肌"]，支持多肌群训练（兼容性保留）
  // equipment         String[] // 完成动作所需的器械设备，如["哑铃", "杠铃"]，空数组表示无需器械
  // duration          Int? // 建议完成时间（秒），主要用于计时类动作
  // reps              Int? // 推荐训练次数，默认每组次数
  // sets              Int? // 推荐训练组数
  // imageUrl          String? // 动作示范图片的 URL 地址
  // videoUrl          String? // 动作演示视频的 URL 地址
  // notes             String? // 动作的注意事项或教练备注
  // isActive          Boolean             @default(true) // 是否启用该动作，禁用后可保留历史记录但不显示在列表中
  // createdAt         DateTime            @default(now()) // 记录创建时间
  // updatedAt         DateTime            @updatedAt // 记录最后更新时间
  // workoutExcercises WorkoutExcercises[] // 关联关系：当前动作关联到的所有训练计划
  // excerciseMuscles  ExcerciseMuscle[] // 关联关系：动作涉及的肌群及其权重信息
}
