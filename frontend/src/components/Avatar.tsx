import type { Skill } from '../api'
import { avatarStyle, initials } from '../lib/styles'

interface AvatarProps {
  id: number
  name: string
  size?: 'sm' | 'md'
}

// initials in a coloured circle, there are no profile pictures in the data
export default function Avatar({ id, name, size = 'md' }: AvatarProps) {
  const sizeClass = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white ${sizeClass} ${avatarStyle(id)}`}
    >
      {initials(name)}
    </span>
  )
}

// when hovered, it shows the developer's name and skills
export function DeveloperTooltip({ name, skills }: { name: string; skills: Skill[] }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute right-0 bottom-full z-30 mb-2 hidden w-max max-w-56 rounded-xl bg-slate-800 px-3 py-2 text-left text-xs text-white shadow-lg group-hover:block group-focus-visible:block"
    >
      <span className="block font-semibold">{name}</span>
      <span className="block text-slate-300">
        {skills.length > 0 ? skills.map((skill) => skill.name).join(', ') : 'No skills'}
      </span>
    </span>
  )
}
