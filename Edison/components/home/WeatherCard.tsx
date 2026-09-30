"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sun, Cloud, CloudSun, CloudRain, CloudLightning, CloudSnow,
  Snowflake, Wind, Droplets, MapPin, RefreshCw,
  ChevronDown,
} from "lucide-react";

/**
 * 天气卡片（数据源：uapis.cn 免费接口，无需 key）
 * 定位：服务端按访客出口 IP 自动判断，前端不传位置参数
 * 必须带 forecast=true 参数，否则返回不含 temp_max/temp_min 与未来预报
 * 限流：每 IP 每天 2000 次，仅在页面加载时请求一次，不做轮询
 */

const API_URL = "https://uapis.cn/api/v1/misc/weather?forecast=true";

// 中国气象局天气代码 → lucide 图标（表外兜底晴天）
function WeatherIcon({ code, className }: { code?: string; className?: string }) {
  const n = Number(code);
  const map: Record<number, React.ComponentType<{ className?: string }>> = {
    100: Sun, 101: Cloud, 102: Cloud, 104: Cloud, 103: CloudSun,
    200: Wind, 201: Droplets, 202: CloudLightning, 206: CloudLightning, 210: CloudLightning,
    203: CloudRain, 205: CloudRain, 208: CloudRain, 209: CloudRain,
    204: Snowflake, 207: CloudSnow,
  };
  const Icon = map[n] ?? Sun;
  return <Icon className={className} />;
}

interface ForecastDay {
  date: string;
  week: string;
  temp_max: number;
  temp_min: number;
  weather_day: string;
  pop?: number; // 降水概率
  cloud?: number; // 云量 %
  uv_index?: number; // 紫外线指数
  precip?: number; // 降水量 mm
  sunrise?: string;
  sunset?: string;
}

interface WeatherData {
  city: string;
  district: string;
  weather: string;
  weather_icon: string;
  temperature: number;
  temp_max: number;
  temp_min: number;
  humidity: number;
  wind_direction?: string;
  wind_power?: string;
  forecast?: ForecastDay[];
}

export default function WeatherCard() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    setError("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(API_URL, { signal: controller.signal });
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const json = await res.json();
      if (!json || !json.city) throw new Error("返回数据异常");
      setData(json);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "加载失败");
      } else {
        setError("请求超时");
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // 三态渲染：加载 / 错误(可重试) / 内容（高度由内容决定，不再设最小高度）
  const shell =
    "w-full rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl flex flex-col relative z-40 p-4 h-full";

  if (loading) {
    return (
      <div className={shell} title="天气">
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
          <Sun className="w-8 h-8 animate-spin" style={{ animationDuration: "3s" }} />
          <span className="text-xs">天气加载中...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={shell} title="天气">
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 text-center px-2">
            {error || "暂无天气数据"}
          </span>
          <button
            onClick={fetchWeather}
            className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 border border-slate-300/60 dark:border-slate-600/60 rounded-full px-3 py-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            重试
          </button>
        </div>
      </div>
    );
  }

  const today = data.forecast?.[0];

  return (
    <div className={shell} title="天气">
      {/* 城市区县 */}
      <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 font-medium">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">
          {data.city || "--"}
          {data.district ? ` · ${data.district}` : ""}
        </span>
      </div>

      {/* 左上角：图标 + 实时温度 */}
      <div className="flex items-center gap-2 mt-2">
        <WeatherIcon code={data.weather_icon} className="w-10 h-10 text-amber-500 dark:text-amber-300" />
        <div className="flex items-start">
          <span className="text-3xl font-black text-slate-800 dark:text-white leading-none tracking-tight">
            {data.temperature ?? "--"}
          </span>
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5">°</span>
        </div>
      </div>

      {/* 天气描述 + 高低温（左对齐） */}
      <div className="flex flex-col items-start gap-0.5 mt-1.5">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {data.weather || "--"}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
          {data.temp_max ?? "--"}° / {data.temp_min ?? "--"}°
        </span>
      </div>

      {/* 弹性占位：在等高布局中把底栏推到卡片底部 */}
      <div className="flex-1" />

      {/* 底部：湿度 + 更多按钮 */}
      <div className="flex items-center justify-center gap-3 text-[10px] md:text-xs text-slate-500 dark:text-slate-400 border-t border-white/30 dark:border-white/10 pt-1.5 md:pt-2">
        <span className="flex items-center gap-1">
          <Droplets className="w-3 h-3" />
          湿度 {data.humidity != null ? `${data.humidity}%` : "--"}
        </span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-0.5 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
          title="更多天气详情"
        >
          更多
          <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* 展开的详情面板：向下弹出 */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-white/30 dark:border-white/10 flex flex-col gap-2 text-[10px] md:text-xs text-slate-600 dark:text-slate-300">
              {/* 当天详细数据（uapis 提供的全部字段） */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {[
                  ["风力", `${data.wind_direction ?? "--"} ${data.wind_power ?? ""}`.trim() || "--"],
                  ["湿度", data.humidity != null ? `${data.humidity}%` : "--"],
                  ["云量", today?.cloud != null ? `${today.cloud}%` : "--"],
                  ["紫外线", today?.uv_index != null ? `${today.uv_index}` : "--"],
                  ["降水量", today?.precip != null ? `${today.precip}mm` : "--"],
                  ["降水概率", today?.pop != null ? `${today.pop}%` : "--"],
                  ["日出", today?.sunrise || "--"],
                  ["日落", today?.sunset || "--"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-1 min-w-0">
                    <span className="text-slate-400 dark:text-slate-500 flex-shrink-0">{label}</span>
                    <span className="font-medium truncate">{value}</span>
                  </div>
                ))}
              </div>

              {/* 未来三天预报 */}
              {(data.forecast ?? []).slice(1, 4).map((d) => (
                <div
                  key={d.date}
                  className="flex items-center justify-between gap-1 border-t border-white/20 dark:border-white/5 pt-1.5"
                >
                  <span className="w-9 flex-shrink-0 font-medium">{d.week?.replace("星期", "周") || d.date?.slice(5)}</span>
                  <span className="flex-1 truncate text-center">{d.weather_day || "--"}</span>
                  <span className="flex-shrink-0 tabular-nums">
                    {d.temp_max}° / {d.temp_min}°
                    {d.pop != null && d.pop > 0 && (
                      <span className="text-sky-500 dark:text-sky-400 ml-1">{d.pop}%</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
