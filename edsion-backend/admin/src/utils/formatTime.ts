import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

/**
 * 格式化后端返回的时间字符串。
 *
 * 后端所有时间字段都以 **带时区的 UTC** 输出（形如 `2026-09-30T02:29:44.830665Z`，
 * 结尾的 `Z` 表示 UTC）。若直接 `slice(0, 19)` 截取，会把 UTC 字面值当成北京时间
 * 展示，导致显示比真实时间早 8 小时。
 *
 * 正确做法：先按 UTC 解析，再转换到访客本地时区渲染。
 *
 * @param value  后端返回的时间字符串（也兼容 Date / 时间戳）
 * @param format dayjs 格式串，默认 `YYYY-MM-DD HH:mm:ss`
 * @param fallback 值为空时的占位符，默认 "-"
 */
export function formatTime(
  value?: string | number | Date | null,
  format = "YYYY-MM-DD HH:mm:ss",
  fallback = "-"
): string {
  if (value === null || value === undefined || value === "") return fallback;
  const d = dayjs.utc(value).local();
  return d.isValid() ? d.format(format) : fallback;
}

export default formatTime;
