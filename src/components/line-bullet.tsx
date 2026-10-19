type LineBulletProps = {
  children: React.ReactNode;
  color: string;
  textColor?: string;
  size?: number;
};

// A round subway line bullet, like the (1) or (A) signs.
export function LineBullet({ children, color, textColor = "#ffffff", size = 28 }: LineBulletProps) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none"
      style={{ backgroundColor: color, color: textColor, width: size, height: size, fontSize: size * 0.55 }}
    >
      {children}
    </span>
  );
}
