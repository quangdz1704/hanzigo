import { Flower2, Sparkles, BookOpen, Leaf, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeading, Badge } from "@/components/Common";
import { GardenArt } from "@/components/Art";
import { useLearning } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
export default function Garden() {
  const { activities, xp, streak, storiesRead, cards } = useLearning();
  const growth = activities.length;
  const level = Math.floor(xp / 100) + 1;
  const decorations = [
    { name: "Chậu hoa đầu tiên", at: 0, icon: Flower2 },
    { name: "Mèo nằm sưởi nắng", at: 3, icon: Heart },
    { name: "Bình tưới nhỏ", at: 6, icon: Leaf },
    { name: "Sách dưới tán cây", at: 10, icon: BookOpen },
    { name: "Đèn vườn lấp lánh", at: 15, icon: Sparkles },
  ];
  return (
    <>
      <PageHeading
        eyebrow="LỚN LÊN CÙNG EM"
        title="Khu vườn của em"
        description="Mỗi câu chuyện, mỗi từ em nhớ lại đều gieo thêm một niềm vui."
        action={<Badge className="badge-sage">Khu vườn cấp {level}</Badge>}
      />
      <section className="card garden-scene">
        <GardenArt growth={growth} />
        <div className="garden-message">
          <h2>
            {growth === 0
              ? "Một hạt giống nhỏ đang chờ em"
              : growth < 3
                ? "Mầm xanh đầu tiên của em"
                : growth < 9
                  ? "Khu vườn đang lớn từng ngày"
                  : "Hoa đã nở trong khu vườn của em"}
          </h2>
          <p className="muted">
            {growth} hoạt động ý nghĩa · {xp} XP được gieo
          </p>
          <div
            className="growth-bar"
            role="progressbar"
            aria-label="Tiến độ lên cấp khu vườn"
            aria-valuenow={xp % 100}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${xp % 100}%` }} />
          </div>
          <p className="muted">
            Còn {100 - (xp % 100)} XP để đến cấp {level + 1}. Không có hạn chót
            đâu nhé.
          </p>
        </div>
      </section>
      <div className="stats-grid garden-stats">
        <div className="card stat-card">
          <BookOpen />
          <strong>{storiesRead}</strong>
          <span>câu chuyện đã đọc</span>
        </div>
        <div className="card stat-card">
          <Leaf />
          <strong>{cards.length}</strong>
          <span>từ trong vườn</span>
        </div>
        <div className="card stat-card">
          <Sparkles />
          <strong>{streak}</strong>
          <span>ngày học liên tiếp</span>
        </div>
      </div>
      <section>
        <h2>Những món nhỏ trong vườn</h2>
        <div className="decoration-grid">
          {decorations.map((d) => (
            <div
              className={`card decoration ${growth >= d.at ? "unlocked" : "locked"}`}
              key={d.name}
            >
              <d.icon size={30} />
              <h3>{d.name}</h3>
              <span>
                {growth >= d.at ? "Đã nở trong vườn" : `Sau ${d.at} hoạt động`}
              </span>
            </div>
          ))}
        </div>
      </section>
      <div className="garden-invitation">
        <p>Hôm nào em nghỉ, khu vườn vẫn ở đây đợi em.</p>
        <Button asChild variant="secondary">
          <Link to="/stories">Đọc thêm một câu chuyện</Link>
        </Button>
      </div>
    </>
  );
}
