import { ShieldAlert } from 'lucide-react';

interface DisclaimerBannerProps {
  compact?: boolean;
}

export function DisclaimerBanner({ compact = false }: DisclaimerBannerProps) {
  return (
    <div
      role="note"
      aria-label="Lưu ý miễn trừ trách nhiệm"
      className={`rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-[#FFFDF7] to-emerald-50/50 text-stone-700 shadow-[0_2px_10px_-4px_rgba(217,119,6,0.12)] ${
        compact ? 'px-3.5 py-2.5 text-xs leading-relaxed' : 'px-4 py-3 text-xs sm:text-sm leading-relaxed'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="h-6 w-6 rounded-lg bg-amber-100 border border-amber-300/60 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldAlert className="h-3.5 w-3.5 text-[#B45309]" aria-hidden="true" />
        </div>
        <p>
          <span className="font-semibold text-[#1F2937]">LƯU Ý: </span>
          FINSMART chỉ cung cấp thông tin tham khảo và hỗ trợ quản lý tài chính cá nhân cơ bản.
          Nội dung tư vấn không phải tư vấn đầu tư, không phải khuyến nghị mua bán chứng khoán, tiền
          mã hóa hoặc các sản phẩm tài chính. Người dùng cần tự đánh giá trước khi đưa ra quyết định.
        </p>
      </div>
    </div>
  );
}
