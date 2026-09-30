"use client";

import dynamic from "next/dynamic";
import SearchBar from "@/components/ui/SearchBar";
import ProfileCard from "@/components/home/ProfileCard";
import FadeIn from "@/components/ui/FadeIn";

const CloudPlayer = dynamic(() => import("@/components/music/CloudPlayer"), { ssr: false });
const WeatherCard = dynamic(() => import("@/components/home/WeatherCard"), { ssr: false });
const LyricBar = dynamic(() => import("@/components/music/LyricBar"), { ssr: false });
const LatestPostsCarousel = dynamic(() => import("@/components/home/LatestPostsCarousel"), { ssr: false });
const LatestChatterCarousel = dynamic(() => import("@/components/home/LatestChatterCarousel"), { ssr: false });
const PhotoWallPreview = dynamic(() => import("@/components/home/PhotoWallPreview"), { ssr: false });
const DogDiary = dynamic(() => import("@/components/home/DogDiary"), { ssr: false });
const SiteDashboard = dynamic(() => import("@/components/widgets/SiteDashboard"), { ssr: false });

export default function HomeClient({
  postCount,
  chatterCount,
  photoCount,
}: {
  postCount: number;
  chatterCount: number;
  photoCount: number;
}) {
  return (
    <div className="w-full max-w-6xl mx-auto py-6 md:py-12 px-4 sm:px-10 relative z-10">
      {/* 搜索栏 */}
      <FadeIn>
        <div className="hidden md:block">
          <SearchBar />
        </div>
      </FadeIn>

      <main className="flex flex-col gap-4 md:gap-6 w-full">
        {/* 第一行：个人信息 + 播放器（桌面恢复原布局；移动端播放器/天气各占一半并排） */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-2 md:grid-cols-12 gap-4 md:gap-6 w-full items-stretch">
            <div className="col-span-2 md:col-span-8 flex w-full">
              <ProfileCard
                postCount={postCount}
                chatterCount={chatterCount}
                photoCount={photoCount}
              />
            </div>
            <div className="col-span-1 md:col-span-4 flex w-full">
              <CloudPlayer />
            </div>
            {/* 移动端内联天气卡（桌面用下方右缘悬浮版） */}
            <div className="col-span-1 md:hidden flex w-full">
              <WeatherCard />
            </div>
          </div>
        </FadeIn>

        {/* 歌词栏 */}
        <FadeIn delay={0.15}>
          <div className="w-full">
            <LyricBar />
          </div>
        </FadeIn>

        {/* 第二行：照片墙 + 文章 + 说说 + 舔狗日记 */}
        <FadeIn delay={0.2}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 w-full items-stretch">
            <div className="md:col-span-4 h-full">
              <PhotoWallPreview />
            </div>
            <div className="md:col-span-8 flex flex-col gap-4 md:gap-6 h-full">
              <LatestPostsCarousel />
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 flex-1 md:min-h-[220px] items-stretch">
                <div className="md:col-span-8 h-full">
                  <LatestChatterCarousel />
                </div>
                <div className="md:col-span-4 h-full flex">
                  <DogDiary />
                </div>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* 底部数据面板 */}
        <FadeIn delay={0.25}>
          <div className="w-full">
            <SiteDashboard />
          </div>
        </FadeIn>
      </main>

      {/* 桌面宽屏：天气卡片悬浮在页面右缘（内容区 max-w-6xl 之外的空余区域）。
          卡片 w-52(208px)+right-2 需要两侧余量 ≥216px，即视口 ≥1600px 才放得下，故门槛用 min-[1600px] */}
      <div className="hidden min-[1600px]:block fixed right-2 top-20 z-40 w-52">
        <WeatherCard />
      </div>
    </div>
  );
}
