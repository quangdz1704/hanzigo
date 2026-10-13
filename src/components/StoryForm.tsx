import type { Story } from "@/content/schema";

/** An editable draft may be incomplete; strict validation remains at the export boundary. */
export function StoryForm({
  story,
  onChange,
  disabled,
}: {
  story: Story;
  onChange: (story: Story) => void;
  disabled: boolean;
}) {
  const change = (edit: (draft: Story) => void) => {
    const draft = structuredClone(story);
    edit(draft);
    onChange(draft);
  };
  return (
    <fieldset className="story-form" disabled={disabled}>
      <legend className="sr-only">Biên tập truyện</legend>
      <div className="editor-fields">
        <label className="field">
          Tên tiếng Việt
          <input
            value={story.titleVi}
            onChange={(e) =>
              change((s) => {
                s.titleVi = e.target.value;
              })
            }
          />
        </label>
        <label className="field">
          Tên tiếng Trung
          <input
            lang="zh-CN"
            value={story.titleZh}
            onChange={(e) =>
              change((s) => {
                s.titleZh = e.target.value;
              })
            }
          />
        </label>
        <label className="field editor-wide">
          Lời giới thiệu
          <input
            value={story.subtitle}
            onChange={(e) =>
              change((s) => {
                s.subtitle = e.target.value;
              })
            }
          />
        </label>
        <label className="field">
          Chủ đề
          <input
            value={story.topic}
            onChange={(e) =>
              change((s) => {
                s.topic = e.target.value;
              })
            }
          />
        </label>
        <label className="field">
          Trình độ tham khảo
          <select
            value={story.difficulty}
            onChange={(e) =>
              change((s) => {
                s.difficulty = e.target.value as Story["difficulty"];
              })
            }
          >
            {["HSK 3", "HSK 4", "HSK 5"].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>
      <h3>Từng câu · {story.paragraphs.flat().length}</h3>
      {story.paragraphs.map((paragraph, pi) =>
        paragraph.map((sentence, si) => (
          <details className="editor-detail" key={sentence.id}>
            <summary>
              Đoạn {pi + 1}, câu {si + 1} · {sentence.hanzi}
            </summary>
            <label className="field">
              Hanzi · {sentence.id}
              <textarea
                lang="zh-CN"
                value={sentence.hanzi}
                onChange={(e) =>
                  change((s) => {
                    s.paragraphs[pi][si].hanzi = e.target.value;
                  })
                }
              />
            </label>
            <label className="field">
              Pinyin có dấu
              <input
                value={sentence.pinyin}
                onChange={(e) =>
                  change((s) => {
                    s.paragraphs[pi][si].pinyin = e.target.value;
                  })
                }
              />
            </label>
            <label className="field">
              Bản dịch Việt
              <textarea
                value={sentence.vi}
                onChange={(e) =>
                  change((s) => {
                    s.paragraphs[pi][si].vi = e.target.value;
                  })
                }
              />
            </label>
            <label className="field">
              Audio HTTPS (tùy chọn)
              <input
                type="url"
                value={sentence.audioUrl ?? ""}
                onChange={(e) =>
                  change((s) => {
                    s.paragraphs[pi][si].audioUrl = e.target.value || undefined;
                  })
                }
              />
            </label>
            <p className="muted">Gắn các mục từ xuất hiện trong câu:</p>
            <div className="editor-mappings">
              {story.glossary.map((v) => (
                <label key={v.id}>
                  <input
                    type="checkbox"
                    checked={sentence.glossaryIds.includes(v.id)}
                    onChange={(e) =>
                      change((s) => {
                        const target = s.paragraphs[pi][si];
                        target.glossaryIds = e.target.checked
                          ? [...target.glossaryIds, v.id]
                          : target.glossaryIds.filter((id) => id !== v.id);
                      })
                    }
                  />
                  {v.hanzi} · {v.meaning}
                </label>
              ))}
            </div>
          </details>
        )),
      )}
      <h3>Mục từ · {story.glossary.length}</h3>
      {story.glossary.map((v, i) => (
        <details className="editor-detail" key={v.id}>
          <summary>
            {v.hanzi} · {v.meaning}
          </summary>
          {(
            [
              ["hanzi", "Từ tiếng Trung"],
              ["pinyin", "Pinyin của từ"],
              ["meaning", "Nghĩa"],
              ["example", "Câu ví dụ"],
              ["examplePinyin", "Pinyin ví dụ"],
              ["exampleVi", "Dịch ví dụ"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="field">
              {label}
              <input
                value={v[field]}
                onChange={(e) =>
                  change((s) => {
                    s.glossary[i][field] = e.target.value;
                  })
                }
              />
            </label>
          ))}
        </details>
      ))}
      <h3>Câu hỏi đọc hiểu</h3>
      {story.comprehensionQuestions.map((q, i) => (
        <details className="editor-detail" key={q.id}>
          <summary>
            Câu hỏi {i + 1} · {q.prompt}
          </summary>
          <label className="field">
            Câu hỏi · Tiếng Việt
            <input
              value={q.prompt}
              onChange={(e) =>
                change((s) => {
                  s.comprehensionQuestions[i].prompt = e.target.value;
                })
              }
            />
          </label>
          {q.chinese && (
            <QuizTranslationFields
              label="Câu hỏi"
              value={q.chinese.prompt}
              onChange={(value) =>
                change((s) => {
                  s.comprehensionQuestions[i].chinese!.prompt = value;
                })
              }
            />
          )}
          {q.options.map((option, oi) => (
            <div key={oi}>
              <label className="field">
                Lựa chọn {oi + 1} · Tiếng Việt
                <input
                  value={option}
                  onChange={(e) =>
                    change((s) => {
                      s.comprehensionQuestions[i].options[oi] = e.target.value;
                    })
                  }
                />
              </label>
              {q.chinese && (
                <QuizTranslationFields
                  label={`Lựa chọn ${oi + 1}`}
                  value={q.chinese.options[oi]}
                  onChange={(value) =>
                    change((s) => {
                      s.comprehensionQuestions[i].chinese!.options[oi] = value;
                    })
                  }
                />
              )}
            </div>
          ))}
          <label className="field">
            Đáp án đúng
            <select
              value={q.answer}
              onChange={(e) =>
                change((s) => {
                  s.comprehensionQuestions[i].answer = Number(e.target.value);
                })
              }
            >
              {q.options.map((option, oi) => (
                <option key={oi} value={oi}>
                  {oi + 1}. {option}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Giải thích · Tiếng Việt
            <textarea
              value={q.explanation}
              onChange={(e) =>
                change((s) => {
                  s.comprehensionQuestions[i].explanation = e.target.value;
                })
              }
            />
          </label>
          {q.chinese ? (
            <QuizTranslationFields
              label="Giải thích"
              value={q.chinese.explanation}
              onChange={(value) =>
                change((s) => {
                  s.comprehensionQuestions[i].chinese!.explanation = value;
                })
              }
            />
          ) : (
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                change((s) => {
                  s.comprehensionQuestions[i].chinese = {
                    prompt: { hanzi: "", pinyin: "" },
                    options: q.options.map(() => ({ hanzi: "", pinyin: "" })),
                    explanation: { hanzi: "", pinyin: "" },
                  };
                })
              }
            >
              Bổ sung Chữ Hán/Pinyin
            </button>
          )}
        </details>
      ))}
      <details className="editor-detail">
        <summary>Câu dùng cho trò xếp từ</summary>
        <label className="field">
          Các cụm từ, ngăn bằng dấu |
          <input
            value={story.wordOrder.words.join("|")}
            onChange={(e) =>
              change((s) => {
                s.wordOrder.words = e.target.value.split("|");
              })
            }
          />
        </label>
        <label className="field">
          Pinyin câu xếp từ
          <input
            value={story.wordOrder.pinyin}
            onChange={(e) =>
              change((s) => {
                s.wordOrder.pinyin = e.target.value;
              })
            }
          />
        </label>
        <label className="field">
          Dịch câu xếp từ
          <input
            value={story.wordOrder.vi}
            onChange={(e) =>
              change((s) => {
                s.wordOrder.vi = e.target.value;
              })
            }
          />
        </label>
      </details>
    </fieldset>
  );
}

function QuizTranslationFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { hanzi: string; pinyin: string };
  onChange: (value: { hanzi: string; pinyin: string }) => void;
}) {
  return (
    <div className="editor-fields quiz-translation-fields">
      <label className="field">
        {label} · Chữ Hán
        <input
          lang="zh-CN"
          value={value.hanzi}
          onChange={(e) => onChange({ ...value, hanzi: e.target.value })}
        />
      </label>
      <label className="field">
        {label} · Pinyin
        <input
          value={value.pinyin}
          onChange={(e) => onChange({ ...value, pinyin: e.target.value })}
        />
      </label>
    </div>
  );
}
