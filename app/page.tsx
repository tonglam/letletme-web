import WelcomePic from '@/components/WelcomePic'
import NextEventFixture from '@/components/NextEventFixture'

export default function Home() {
  return (
    <main className="flex min-h-full flex-col items-center justify-between p-5">
      <WelcomePic />
      <br />
      <div className="text-2xl items-center">
        <p>GW15</p>
        <p>2021-12-06 03:30:00</p>
        <p>这破游戏</p>
      </div>
      <br />
      <NextEventFixture />
    </main>
  )
}
