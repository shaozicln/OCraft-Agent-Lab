import { BadRequestException } from '@nestjs/common';
import { communityShortNameSchema } from '@ocraft/shared';

/** NFC + 短名校验；失败抛 BadRequest */
export function normalizeCommunityShortName(raw: string): string {
  const parsed = communityShortNameSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? '短名非法';
    throw new BadRequestException(msg);
  }
  return parsed.data;
}

/** 用户世界唯一 id：u{playerId}_{shortName}（可含中文） */
export function makeUserWorldId(playerId: string, shortName: string): string {
  const name = normalizeCommunityShortName(shortName);
  const id = `u${playerId}_${name}`;
  if (id.length > 96) {
    throw new BadRequestException(
      `世界短名过长：生成的 world_id 超过 96 字符（${id.length}）`,
    );
  }
  return id.normalize('NFC');
}
