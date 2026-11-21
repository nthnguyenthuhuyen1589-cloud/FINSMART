import { ArrowRight, BookOpen, CheckCircle2, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { DisclaimerBanner } from './DisclaimerBanner.tsx';

interface FinancialGuideViewProps {
  onAskScenario: (prompt: string) => void;
}

type ScenarioGroup = 'all' | 'student' | 'early_career' | 'crisis';

interface GuideScenario {
  id: string;
  group: Exclude<ScenarioGroup, 'all'>;
  groupLabel: string;
  title: string;
  situation: string;
  keyTakeaways: string[];
  prompt: string;
}

const SCENARIOS: GuideScenario[] = [
  {
    id: 'student-budget',
    group: 'student',
    groupLabel: 'Sinh viên',
    title: 'Quản lý sinh hoạt phí 4–5 triệu/tháng khi ở trọ',
    situation:
      'Tiền trọ, ăn uống và di chuyển chiếm phần lớn ngân sách, khiến cuối tháng dễ thiếu hụt hoặc không giữ lại được đồng nào.',
    keyTakeaways: [
      'Chốt trước phần tiền cố định (trọ, điện nước, gửi xe) ngay ngày đầu nhận tiền.',
      'Chia tiền ăn uống theo tuần để tránh tiêu dồn vào đầu tháng.',
      'Trích trước dù chỉ 200.000–300.000 đ/tháng vào quỹ dự phòng riêng.',
    ],
    prompt:
      'Tôi là sinh viên ở trọ với khoảng 4,5 triệu đồng/tháng. Hãy giúp tôi chia ngân sách cụ thể theo tuần và cách giữ được quỹ dự phòng nhỏ.',
  },
  {
    id: 'irregular-income',
    group: 'student',
    groupLabel: 'Sinh viên & Làm thêm',
    title: 'Thu nhập không cố định từ việc làm thêm hoặc tự do',
    situation:
      'Tháng nhận nhiều, tháng nhận ít nên rất khó áp dụng tỷ lệ cố định máy móc và dễ tiêu hết trong tháng có thu nhập cao.',
    keyTakeaways: [
      'Xác định mức chi tiêu sinh hoạt tối thiểu hằng tháng làm chuẩn an toàn.',
      'Tháng thu nhập cao hơn chuẩn, ưu tiên bù phần dư vào quỹ dự phòng cho tháng thấp điểm.',
      'Không nâng mức chi tiêu cố định chỉ vì một tháng có thưởng hoặc làm thêm nhiều.',
    ],
    prompt:
      'Thu nhập hàng tháng của tôi không ổn định, lúc nhiều lúc ít. Tôi nên lập ngân sách và chia tiền như thế nào để luôn chủ động?',
  },
  {
    id: 'first-job',
    group: 'early_career',
    groupLabel: 'Người mới đi làm',
    title: 'Cách phân bổ những tháng lương đầu tiên',
    situation:
      'Khi mới đi làm, thu nhập tăng lên nhưng các khoản giao tiếp, đi lại và mua sắm cũng tăng nhanh theo.',
    keyTakeaways: [
      'Tách riêng tài khoản nhận lương và tài khoản chi tiêu hàng ngày.',
      'Ưu tiên hoàn thành quỹ dự phòng 3 tháng chi tiêu thiết yếu trước các kế hoạch lớn.',
      'Kiểm soát các khoản đăng ký định kỳ và chi phí ăn ngoài hàng tuần.',
    ],
    prompt:
      'Tôi mới đi làm và nhận lương hàng tháng. Hãy gợi ý cho tôi cách phân chia tiền lương hợp lý và xây dựng quỹ dự phòng ban đầu.',
  },
  {
    id: 'overspending',
    group: 'crisis',
    groupLabel: 'Xử lý tình huống',
    title: 'Chi tiêu vượt thu nhập và hay phát sinh đột xuất',
    situation:
      'Cuối tháng thường bị âm tiền vì các khoản nhỏ lẻ cộng dồn hoặc những chi phí bất ngờ như sửa xe, khám bệnh, hiếu hỉ.',
    keyTakeaways: [
      'Rà soát lại 3 nhóm chi linh hoạt lớn nhất trong 30 ngày gần nhất.',
      'Tạm cắt 20–30% các khoản chưa cấp bách trong 1–2 tháng để lấy lại cân bằng.',
      'Lập riêng một khoản đệm "chi phí phát sinh" hàng tháng ngay trong ngân sách.',
    ],
    prompt:
      'Chi tiêu hàng tháng của tôi đang vượt quá thu nhập và hay có khoản phát sinh bất ngờ. Tôi cần cắt giảm và sắp xếp lại từ đâu?',
  },
  {
    id: 'consumer-loan',
    group: 'crisis',
    groupLabel: 'Xử lý tình huống',
    title: 'Cân nhắc trước khi vay tiền cho nhu cầu cá nhân',
    situation:
      'Muốn mua thiết bị học tập/làm việc hoặc chi tiêu gấp bằng hình thức vay trả góp nhưng băn khoăn áp lực trả nợ về sau.',
    keyTakeaways: [
      'Chỉ cân nhắc vay khi thực sự phục vụ nhu cầu thiết yếu hoặc tạo thu nhập, không vay để tiêu dùng giải trí.',
      'Tổng tiền trả góp hàng tháng không nên vượt quá 20–25% phần thu nhập còn dư sau chi thiết yếu.',
      'Tính rõ tổng số tiền lãi phải trả thay vì chỉ nhìn số tiền góp mỗi tháng.',
    ],
    prompt:
      'Tôi đang cân nhắc vay tiền cho nhu cầu cá nhân. Hãy giúp tôi phân tích điều kiện an toàn và khi nào nên tích lũy trước thay vì vay.',
  },
  {
    id: 'emergency-fund',
    group: 'early_career',
    groupLabel: 'Quỹ dự phòng',
    title: 'Xây dựng quỹ dự phòng từng bước mà không áp lực',
    situation:
      'Mục tiêu quỹ dự phòng vài chục triệu nghe quá xa vời khiến nhiều người bỏ cuộc ngay từ tháng đầu tiên.',
    keyTakeaways: [
      'Chia mục tiêu thành từng cột mốc nhỏ: mốc 1 tháng chi tiêu thiết yếu, rồi mới đến 3 tháng.',
      'Gửi ở nơi tách biệt với ví thanh toán hàng ngày nhưng vẫn dễ rút khi khẩn cấp.',
      'Duy trì đều đặn mỗi tháng thay vì cố dồn quá mức rồi phải rút ra tiêu lại.',
    ],
    prompt:
      'Tôi muốn xây dựng quỹ dự phòng cá nhân từ con số 0 mà không bị áp lực quá lớn lên sinh hoạt hàng tháng. Tôi nên bắt đầu thế nào?',
  },
];

const SAFETY_PRINCIPLES = [
  'Ghi nhận và rà soát dòng tiền định kỳ theo ngày, tháng, năm để nắm rõ thói quen chi tiêu thực tế.',
  'Luôn ưu tiên đảm bảo nhu cầu thiết yếu và quỹ dự phòng an toàn trước các mục tiêu nâng cao.',
  'Tránh vay nợ tiêu dùng lãi suất cao hoặc cam kết các khoản trả góp vượt quá khả năng chi trả hàng tháng.',
  'Mọi kế hoạch ngân sách đều mang tính linh hoạt: hãy điều chỉnh kịp thời khi thu nhập hoặc hoàn cảnh thay đổi.',
];

export function FinancialGuideView({ onAskScenario }: FinancialGuideViewProps) {
  const [group, setGroup] = useState<ScenarioGroup>('all');

  const visibleScenarios =
    group === 'all' ? SCENARIOS : SCENARIOS.filter((item) => item.group === group);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6"
    >
      {/* Header & Filter Bar */}
      <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-[#B45309] shrink-0 mt-0.5">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1F2937]">
              Cẩm nang xử lý tình huống tài chính
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
              Tổng hợp các tình huống quen thuộc giúp bạn tham khảo nguyên tắc quản lý tiền bạc và mở nhanh cuộc trò chuyện với chuyên gia.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F3EDE2]/80 border border-stone-200/70 rounded-xl self-start lg:self-auto">
          {[
            { key: 'all' as const, label: 'Tất cả' },
            { key: 'student' as const, label: 'Sinh viên' },
            { key: 'early_career' as const, label: 'Người mới đi làm' },
            { key: 'crisis' as const, label: 'Xử lý tình huống' },
          ].map((tab) => {
            const active = group === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setGroup(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#0F766E] text-white shadow-sm font-semibold'
                    : 'text-stone-600 hover:text-[#1F2937] hover:bg-white/80'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Symmetrical 2-Column Scenario Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {visibleScenarios.map((item) => (
          <article
            key={item.id}
            className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_28px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col justify-between gap-4"
          >
            <div>
              <div className="text-xs font-semibold text-[#0F766E] mb-1">{item.groupLabel}</div>
              <h3 className="text-base font-bold text-[#1F2937] leading-snug">{item.title}</h3>
              <p className="text-xs sm:text-sm text-stone-600 mt-2 leading-relaxed">
                {item.situation}
              </p>

              <ul className="mt-4 space-y-2">
                {item.keyTakeaways.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-stone-700">
                    <CheckCircle2
                      className="h-4 w-4 text-[#059669] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span className="leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-stone-100 flex justify-end">
              <button
                type="button"
                onClick={() => onAskScenario(item.prompt)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <span>Hỏi chuyên gia về tình huống này</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Symmetrical Principles & Disclaimer */}
      <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_28px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-[#0F766E]" aria-hidden="true" />
          <h3 className="text-base font-bold text-[#1F2937]">
            Nguyên tắc quản lý tài chính cá nhân an toàn
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SAFETY_PRINCIPLES.map((principle, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 text-xs sm:text-sm text-stone-700 leading-relaxed flex items-start gap-2.5"
            >
              <span className="h-5 w-5 rounded-md bg-emerald-100 text-[#059669] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                {idx + 1}
              </span>
              <span>{principle}</span>
            </div>
          ))}
        </div>
        <DisclaimerBanner />
      </section>
    </motion.div>
  );
}
