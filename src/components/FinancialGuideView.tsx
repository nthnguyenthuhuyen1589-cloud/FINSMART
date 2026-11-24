import {
  BookOpen,
  Calculator,
  CheckCircle2,
  HeartPulse,
  PiggyBank,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import type { AdvisoryMode, FinancialProfile } from '../types.ts';
import { formatVnd } from '../utils/format.ts';
import { DisclaimerBanner } from './DisclaimerBanner.tsx';
import { MoneyInput } from './MoneyInput.tsx';

interface FinancialGuideViewProps {
  profile?: FinancialProfile;
  aiEnabled: boolean;
  onAskScenario: (prompt: string, mode?: AdvisoryMode, overrideAiEnabled?: boolean) => void;
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
  {
    id: 'tuition-support',
    group: 'early_career',
    groupLabel: 'Người mới đi làm',
    title: 'Vừa đi làm vừa trả nợ học phí hoặc gửi tiền hỗ trợ gia đình',
    situation:
      'Khoản cố định hàng tháng cộng thêm nghĩa vụ gia đình khiến bạn dễ chần chừ không dám dành tiền cho bản thân.',
    keyTakeaways: [
      'Cố định một tỷ lệ hỗ trợ/trả nợ rõ ràng ngay khi nhận lương để không vượt khả năng.',
      'Giữ lại ít nhất 5–10% thu nhập cho quỹ dự phòng cá nhân để không phải vay lại khi ốm đau.',
      'Trao đổi minh bạch với gia đình khi có thay đổi thu nhập đột xuất.',
    ],
    prompt:
      'Tôi mới đi làm và cần trích một phần lương hàng tháng để trả nợ học phí/hỗ trợ gia đình. Hãy giúp tôi cân đối sao cho vẫn giữ được quỹ dự phòng tối thiểu.',
  },
  {
    id: 'bonus-windfall',
    group: 'crisis',
    groupLabel: 'Tối ưu nguồn thu',
    title: 'Phân bổ khoản thưởng cuối năm hoặc tiền thu thêm đột xuất',
    situation:
      'Tiền thưởng hoặc thu nhập bất ngờ thường dễ bị tiêu hết vào mua sắm cảm tính chỉ trong vài tuần.',
    keyTakeaways: [
      'Chia theo quy tắc an toàn: 50% bù quỹ dự phòng/mục tiêu lớn, 30% chi phí cần thiết sắp tới, 20% tự thưởng bản thân.',
      'Ưu tiên xử lý các khoản nợ ngắn hạn hoặc chi phí định kỳ lớn (bảo hiểm, học phí) trước.',
      'Chuyển ngay phần tích lũy sang tài khoản riêng trong ngày nhận tiền.',
    ],
    prompt:
      'Tôi sắp có một khoản tiền thưởng/thu thêm đột xuất. Hãy gợi ý cho tôi cách phân bổ hợp lý giữa quỹ dự phòng, mục tiêu lớn và chi tiêu cá nhân.',
  },
  {
    id: 'subscription-audit',
    group: 'early_career',
    groupLabel: 'Người mới đi làm',
    title: 'Kiểm soát chi phí cố định ngầm & dịch vụ định kỳ hàng tháng',
    situation:
      'Các gói ứng dụng, tập gym, mua sắm trả sau nhỏ lẻ cộng lại dễ chiếm 10–15% thu nhập mà không để ý.',
    keyTakeaways: [
      'Liệt kê toàn bộ khoản trừ tự động mỗi tháng và cắt bỏ ngay dịch vụ dùng dưới 2 lần/tháng.',
      'Chuyển phần tiền tiết kiệm được từ việc cắt gói thừa sang hũ dự phòng tự động.',
      'Đặt hạn mức chi tiêu không thiết yếu theo tuần để dễ theo dõi.',
    ],
    prompt:
      'Tôi cảm thấy tiền lương hàng tháng hay bị hao hụt vào nhiều khoản đăng ký dịch vụ và chi tiêu nhỏ lẻ. Hãy hướng dẫn tôi rà soát và cắt giảm hiệu quả.',
  },
  {
    id: 'medical-family-unexpected',
    group: 'crisis',
    groupLabel: 'Xử lý tình huống',
    title: 'Ứng phó khi phải chi khoản lớn đột xuất cho sức khỏe hoặc gia đình',
    situation:
      'Sau một khoản chi khẩn cấp lớn, quỹ dự phòng bị rút cạn và dòng tiền tháng hiện tại bị đảo lộn.',
    keyTakeaways: [
      'Không hoảng loạn hay vay nóng lãi cao; ưu tiên rà soát các khoản có thể giãn tiến độ.',
      'Kích hoạt chế độ ngân sách tối giản trong 30–60 ngày để lấp lại mốc dự phòng đầu tiên.',
      'Chia nhỏ lộ trình bù quỹ theo tuần để sớm khôi phục cảm giác an toàn.',
    ],
    prompt:
      'Tôi vừa phải chi một khoản lớn đột xuất khiến ngân sách bị hụt mạnh. Hãy lập giúp tôi phương án phục hồi tài chính trong 60 ngày tới.',
  },
];

const SAFETY_PRINCIPLES = [
  'Ghi nhận và rà soát dòng tiền định kỳ theo ngày, tháng, năm để nắm rõ thói quen chi tiêu thực tế.',
  'Luôn ưu tiên đảm bảo nhu cầu thiết yếu và quỹ dự phòng an toàn trước các mục tiêu nâng cao.',
  'Tránh vay nợ tiêu dùng lãi suất cao hoặc cam kết các khoản trả góp vượt quá khả năng chi trả hàng tháng.',
  'Mọi kế hoạch ngân sách đều mang tính linh hoạt: hãy điều chỉnh kịp thời khi thu nhập hoặc hoàn cảnh thay đổi.',
];

export function FinancialGuideView({
  profile,
  aiEnabled,
  onAskScenario,
}: FinancialGuideViewProps) {
  const [group, setGroup] = useState<ScenarioGroup>('all');

  // Tool 1: Instant Health Check (defaults from profile if available)
  const profileEssential = (profile?.expenses ?? [])
    .filter((e) => e.isEssential)
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const profileFlexible = (profile?.expenses ?? [])
    .filter((e) => !e.isEssential)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const [healthIncome, setHealthIncome] = useState<number>(profile?.monthlyIncome || 5_000_000);
  const [healthEssential, setHealthEssential] = useState<number>(
    profileEssential > 0 ? profileEssential : 2_800_000
  );
  const [healthFlexible, setHealthFlexible] = useState<number>(
    profileFlexible > 0 ? profileFlexible : 1_200_000
  );

  // Tool 2: Loan / Installment Safety Check
  const [loanAmount, setLoanAmount] = useState<number>(15_000_000);
  const [loanMonths, setLoanMonths] = useState<number>(12);
  const [loanAnnualRate, setLoanAnnualRate] = useState<number>(14);

  // Tool 3: Savings Goal Speed Planner
  const [goalAmount, setGoalAmount] = useState<number>(
    profile?.targetAmount && profile.targetAmount > 0 ? profile.targetAmount : 12_000_000
  );
  const [goalAlreadySaved, setGoalAlreadySaved] = useState<number>(0);
  const [goalMonthlySave, setGoalMonthlySave] = useState<number>(1_500_000);

  // Computed metrics for Tool 1
  const totalHealthOut = healthEssential + healthFlexible;
  const healthSurplus = healthIncome - totalHealthOut;
  const essentialPct = healthIncome > 0 ? Math.round((healthEssential / healthIncome) * 100) : 0;
  const savingsPct = healthIncome > 0 ? Math.round((healthSurplus / healthIncome) * 100) : 0;
  const healthStatus =
    healthIncome <= 0
      ? 'Chưa có thu nhập'
      : healthSurplus < 0
        ? 'Đang bội chi'
        : savingsPct >= 20 && essentialPct <= 60
          ? 'Cân đối tốt'
          : 'Cần tối ưu thêm';

  // Computed metrics for Tool 2
  const safeMonths = Math.max(1, loanMonths);
  const monthlyRate = Math.max(0, loanAnnualRate) / 100 / 12;
  const monthlyInstallment =
    loanAmount <= 0
      ? 0
      : monthlyRate === 0
        ? Math.round(loanAmount / safeMonths)
        : Math.round(
            (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, safeMonths)) /
              (Math.pow(1 + monthlyRate, safeMonths) - 1)
          );
  const totalRepayment = monthlyInstallment * safeMonths;
  const totalInterest = Math.max(0, totalRepayment - loanAmount);
  const loanToSurplusPct =
    healthSurplus > 0 ? Math.round((monthlyInstallment / healthSurplus) * 100) : 999;

  // Computed metrics for Tool 3
  const remainingGoalAmount = Math.max(0, goalAmount - goalAlreadySaved);
  const monthsNeeded =
    remainingGoalAmount > 0 && goalMonthlySave > 0
      ? Math.ceil(remainingGoalAmount / goalMonthlySave)
      : 0;
  const weeklyNeeded = goalMonthlySave > 0 ? Math.round(goalMonthlySave / 4.33) : 0;

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

      {/* Interactive Financial Advisory Tools */}
      <section className="bg-[#FFFEFC]/95 border border-stone-200/90 shadow-[0_10px_30px_-14px_rgba(28,25,23,0.08)] rounded-2xl p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-[#1F2937]">
            Công cụ kiểm tra & tư vấn tài chính nhanh
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
            Thử nhanh các con số của bạn rồi gửi trực tiếp sang khung trò chuyện để nhận phương án cá nhân hóa.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* Card 1: Health Check */}
          <div className="rounded-2xl border border-stone-200/90 bg-[#FAF8F5] p-4 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#0F766E]">
                <HeartPulse className="h-4 w-4 shrink-0" aria-hidden="true" />
                <h4 className="text-sm font-bold text-[#1F2937]">Sức khỏe thu – chi tháng</h4>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Thu nhập / tháng
                  </label>
                  <MoneyInput size="sm" value={healthIncome} onChange={setHealthIncome} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Chi thiết yếu (trọ, ăn, đi lại...)
                  </label>
                  <MoneyInput size="sm" value={healthEssential} onChange={setHealthEssential} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Chi linh hoạt (giải trí, mua sắm...)
                  </label>
                  <MoneyInput size="sm" value={healthFlexible} onChange={setHealthFlexible} />
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-stone-200/80 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">Trạng thái:</span>
                  <span
                    className={`font-bold ${
                      healthSurplus < 0
                        ? 'text-red-600'
                        : savingsPct >= 20
                          ? 'text-[#059669]'
                          : 'text-[#B45309]'
                    }`}
                  >
                    {healthStatus}
                  </span>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span className="text-stone-500">Còn dư / tháng:</span>
                  <span className="font-semibold text-[#1F2937]">{formatVnd(healthSurplus)}</span>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span className="text-stone-500">Tỷ lệ thiết yếu / dư:</span>
                  <span className="font-medium text-stone-700">
                    {essentialPct}% / {savingsPct}%
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onAskScenario(
                    `Thu nhập của tôi khoảng ${formatVnd(healthIncome)}/tháng, chi thiết yếu ${formatVnd(healthEssential)}, chi linh hoạt ${formatVnd(healthFlexible)} (còn dư ${formatVnd(healthSurplus)}). Hãy phân tích sức khỏe tài chính và gợi ý cách tối ưu ngay.`,
                    healthSurplus < 0 ? 'debt_recovery' : 'cut_expenses',
                    true
                  )
                }
                className={`inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  aiEnabled
                    ? 'text-white bg-gradient-to-r from-[#059669] to-[#0D9488] shadow-xs hover:shadow-md'
                    : 'text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Tư vấn Có AI</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onAskScenario(
                    `Thu nhập của tôi khoảng ${formatVnd(healthIncome)}/tháng, chi thiết yếu ${formatVnd(healthEssential)}, chi linh hoạt ${formatVnd(healthFlexible)} (còn dư ${formatVnd(healthSurplus)}). Hãy phân tích sức khỏe tài chính và gợi ý cách tối ưu ngay.`,
                    healthSurplus < 0 ? 'debt_recovery' : 'cut_expenses',
                    false
                  )
                }
                className={`inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  !aiEnabled
                    ? 'text-white bg-gradient-to-r from-[#B45309] to-[#D97706] shadow-xs hover:shadow-md'
                    : 'text-[#B45309] bg-amber-50 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <Calculator className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Tính Không AI</span>
              </button>
            </div>
          </div>

          {/* Card 2: Loan Safety Check */}
          <div className="rounded-2xl border border-stone-200/90 bg-[#FAF8F5] p-4 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#B45309]">
                <Calculator className="h-4 w-4 shrink-0" aria-hidden="true" />
                <h4 className="text-sm font-bold text-[#1F2937]">Kiểm tra ngưỡng an toàn vay</h4>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Số tiền dự kiến vay / trả góp
                  </label>
                  <MoneyInput size="sm" value={loanAmount} onChange={setLoanAmount} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 mb-1">
                      Kỳ hạn (tháng)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={loanMonths}
                      onChange={(e) => setLoanMonths(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-stone-200 rounded-xl text-right focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 mb-1">
                      Lãi suất (%/năm)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={loanAnnualRate}
                      onChange={(e) => setLoanAnnualRate(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-stone-200 rounded-xl text-right focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20"
                    />
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-stone-200/80 text-xs space-y-1">
                <div className="flex justify-between tabular-nums">
                  <span className="text-stone-500">Trả góp mỗi tháng:</span>
                  <span className="font-bold text-[#1F2937]">{formatVnd(monthlyInstallment)}</span>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span className="text-stone-500">Tổng tiền lãi ước tính:</span>
                  <span className="font-medium text-[#B45309]">{formatVnd(totalInterest)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Mức độ áp lực:</span>
                  <span
                    className={`font-semibold ${
                      healthSurplus <= 0 || loanToSurplusPct > 50
                        ? 'text-red-600'
                        : loanToSurplusPct <= 35
                          ? 'text-[#059669]'
                          : 'text-[#B45309]'
                    }`}
                  >
                    {healthSurplus <= 0
                      ? 'Rủi ro cao (chưa có dư)'
                      : loanToSurplusPct <= 35
                        ? 'Trong ngưỡng chịu được'
                        : 'Áp lực trả nợ lớn'}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onAskScenario(
                    `Tôi dự định vay/trả góp ${formatVnd(loanAmount)} trong ${safeMonths} tháng với lãi suất khoảng ${loanAnnualRate}%/năm (góp khoảng ${formatVnd(monthlyInstallment)}/tháng, tổng lãi ${formatVnd(totalInterest)}). Với thu nhập ${formatVnd(healthIncome)}/tháng và phần dư ${formatVnd(healthSurplus)}/tháng, tôi có nên vay không hay nên tích lũy trước?`,
                    'loan_check',
                    true
                  )
                }
                className={`inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  aiEnabled
                    ? 'text-white bg-gradient-to-r from-[#0F766E] to-[#059669] shadow-xs hover:shadow-md'
                    : 'text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Hỏi Có AI</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onAskScenario(
                    `Tôi dự định vay/trả góp ${formatVnd(loanAmount)} trong ${safeMonths} tháng với lãi suất khoảng ${loanAnnualRate}%/năm (góp khoảng ${formatVnd(monthlyInstallment)}/tháng, tổng lãi ${formatVnd(totalInterest)}). Với thu nhập ${formatVnd(healthIncome)}/tháng và phần dư ${formatVnd(healthSurplus)}/tháng, tôi có nên vay không hay nên tích lũy trước?`,
                    'loan_check',
                    false
                  )
                }
                className={`inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  !aiEnabled
                    ? 'text-white bg-gradient-to-r from-[#B45309] to-[#D97706] shadow-xs hover:shadow-md'
                    : 'text-[#B45309] bg-amber-50 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <Calculator className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Đánh giá Không AI</span>
              </button>
            </div>
          </div>

          {/* Card 3: Savings Speed Planner */}
          <div className="rounded-2xl border border-stone-200/90 bg-[#FAF8F5] p-4 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#059669]">
                <PiggyBank className="h-4 w-4 shrink-0" aria-hidden="true" />
                <h4 className="text-sm font-bold text-[#1F2937]">Lộ trình mục tiêu tiết kiệm</h4>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Số tiền mục tiêu muốn đạt
                  </label>
                  <MoneyInput size="sm" value={goalAmount} onChange={setGoalAmount} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Số tiền đã có sẵn hiện tại
                  </label>
                  <MoneyInput size="sm" value={goalAlreadySaved} onChange={setGoalAlreadySaved} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Mức có thể để dành mỗi tháng
                  </label>
                  <MoneyInput size="sm" value={goalMonthlySave} onChange={setGoalMonthlySave} />
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-stone-200/80 text-xs space-y-1">
                <div className="flex justify-between tabular-nums">
                  <span className="text-stone-500">Thời gian dự kiến:</span>
                  <span className="font-bold text-[#059669]">
                    {remainingGoalAmount === 0
                      ? 'Đã đủ mục tiêu'
                      : monthsNeeded > 0
                        ? `${monthsNeeded} tháng`
                        : 'Chưa xác định'}
                  </span>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span className="text-stone-500">Cần trích mỗi tuần:</span>
                  <span className="font-semibold text-[#1F2937]">{formatVnd(weeklyNeeded)}</span>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span className="text-stone-500">Quỹ dự phòng 3 tháng:</span>
                  <span className="font-medium text-stone-700">{formatVnd(healthEssential * 3)}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onAskScenario(
                    `Tôi muốn đạt mục tiêu tiết kiệm ${formatVnd(goalAmount)} (hiện đã có ${formatVnd(goalAlreadySaved)}, còn thiếu ${formatVnd(remainingGoalAmount)}) với mức trích khoảng ${formatVnd(goalMonthlySave)}/tháng (dự kiến ${monthsNeeded} tháng, tương đương ${formatVnd(weeklyNeeded)}/tuần). Hãy lập cho tôi lộ trình hành động cụ thể và cách giữ kỷ luật.`,
                    'savings_goal',
                    true
                  )
                }
                className={`inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  aiEnabled
                    ? 'text-white bg-gradient-to-r from-[#059669] to-[#0D9488] shadow-xs hover:shadow-md'
                    : 'text-[#0F766E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Lộ trình Có AI</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onAskScenario(
                    `Tôi muốn đạt mục tiêu tiết kiệm ${formatVnd(goalAmount)} (hiện đã có ${formatVnd(goalAlreadySaved)}, còn thiếu ${formatVnd(remainingGoalAmount)}) với mức trích khoảng ${formatVnd(goalMonthlySave)}/tháng (dự kiến ${monthsNeeded} tháng, tương đương ${formatVnd(weeklyNeeded)}/tuần). Hãy lập cho tôi lộ trình hành động cụ thể và cách giữ kỷ luật.`,
                    'savings_goal',
                    false
                  )
                }
                className={`inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  !aiEnabled
                    ? 'text-white bg-gradient-to-r from-[#B45309] to-[#D97706] shadow-xs hover:shadow-md'
                    : 'text-[#B45309] bg-amber-50 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <Calculator className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Lộ trình Không AI</span>
              </button>
            </div>
          </div>
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

            <div className="pt-3 border-t border-stone-100 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => onAskScenario(item.prompt, 'general', true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#059669] to-[#0D9488] rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Hỏi Có AI</span>
              </button>
              <button
                type="button"
                onClick={() => onAskScenario(item.prompt, 'general', false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#B45309] bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer"
              >
                <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Phân tích Không AI</span>
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
