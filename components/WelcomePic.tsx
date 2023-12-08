import Image from 'next/image'
import picture from '../public/images/lie_down.jpeg'

export default function WelcomePic() {
  return (
    <section className="w-full mx-auto">
      <Image
        className="border-4 border-black dark:border-slate-500 drop-shadow-xl shadow-black rounded-full mx-auto mt-8"
        src={picture}
        alt="Welcome Picture"
        priority={true}
      />
    </section>
  )
}
