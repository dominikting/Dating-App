interface AvatarProps {
  name: string;
  hue: number;
  size?: number;
}

export default function Avatar({ name, hue, size = 96 }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const background = `linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${(hue + 40) % 360} 80% 48%))`;
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        background,
        fontSize: size * 0.42,
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
