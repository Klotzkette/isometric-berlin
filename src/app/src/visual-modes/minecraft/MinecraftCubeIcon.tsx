type MinecraftCubeIconProps = {
  size?: number;
};

export function MinecraftCubeIcon({ size = 20 }: MinecraftCubeIconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path d="m12 2 9 5-9 5-9-5 9-5Z" fill="#76b852" />
      <path d="m3 7 9 5v10l-9-5V7Z" fill="#5c4937" />
      <path d="m21 7-9 5v10l9-5V7Z" fill="#806348" />
      <path d="m6 8.7 3 1.7v3.2l-3-1.7V8.7Z" fill="#8bc665" />
      <path d="m15 10.4 3-1.7v3.2l-3 1.7v-3.2Z" fill="#a06e45" />
      <path d="m12 2 9 5-9 5-9-5 9-5Z" stroke="currentColor" strokeWidth="1.25" />
      <path d="m3 7 9 5 9-5M12 12v10M3 7v10l9 5 9-5V7" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
