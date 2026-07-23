// 게시판 좋아요용 하트 아이콘. filled=true 면 채워진 하트.
export function Heart({ filled, className = "h-3.5 w-3.5" }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20.5C11 20.5 3.5 15.6 3.5 9.6 3.5 6.8 5.7 4.6 8.5 4.6c1.7 0 3 .9 3.5 2 .5-1.1 1.8-2 3.5-2 2.8 0 5 2.2 5 5 0 6-8.5 10.9-8.5 10.9z" />
    </svg>
  );
}
