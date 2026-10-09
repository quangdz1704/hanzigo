import type { Story } from "@/content/schema";
export function Flower({
  x = 0,
  y = 0,
  color = "#dfa2ad",
  scale = 1,
}: {
  x?: number;
  y?: number;
  color?: string;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0Q-9 38 0 72" fill="none" stroke="#7b9c78" strokeWidth="4" />
      <path
        d="M-1 40Q-38 14-26 44Q-18 54-1 48M0 55Q28 28 28 49Q16 62 0 61"
        fill="#97b48c"
      />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse
          key={a}
          rx="12"
          ry="21"
          cy="-17"
          fill={color}
          transform={`rotate(${a})`}
        />
      ))}
      <circle r="12" fill="#f5d682" />
      <circle cx="-4" cy="-1" r="1.3" fill="#7a6652" />
      <circle cx="4" cy="-1" r="1.3" fill="#7a6652" />
      <path
        d="M-3 4Q0 7 3 4"
        fill="none"
        stroke="#7a6652"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </g>
  );
}
export function GardenArt({
  growth = 0,
  className = "",
}: {
  growth?: number;
  className?: string;
}) {
  const flowers = Math.min(5, Math.floor(growth / 3) + 1);
  return (
    <svg
      viewBox="0 0 420 270"
      className={className}
      role="img"
      aria-label={`Khu vườn nhỏ với ${flowers} bông hoa`}
    >
      <defs>
        <linearGradient id="garden-sky" x2="0" y2="1">
          <stop stopColor="#edf2e6" />
          <stop offset="1" stopColor="#f7f5e9" />
        </linearGradient>
      </defs>
      <rect width="420" height="270" rx="28" fill="url(#garden-sky)" />
      <circle cx="336" cy="53" r="24" fill="#f4dfab" />
      <path
        d="M55 60Q57 42 73 44Q87 24 101 45Q125 40 128 60ZM217 87Q218 73 230 74Q243 57 255 75Q273 70 277 87Z"
        fill="#fff"
        opacity=".75"
      />
      <path d="M0 209Q82 170 167 200Q266 158 420 194V270H0Z" fill="#d9e3c7" />
      <path d="M0 239Q180 179 420 239V270H0Z" fill="#c3d1ae" />
      <path
        d="M38 217H385M48 194V232M76 191V228M357 191V232M382 196V237"
        fill="none"
        stroke="#eee7d7"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {flowers >= 1 && <Flower x={175} y={152} scale={0.75} />}{" "}
      {flowers >= 2 && <Flower x={248} y={125} scale={0.95} color="#c4b2d4" />}
      {flowers >= 3 && <Flower x={103} y={140} scale={0.8} color="#f2ce8a" />}
      {flowers >= 4 && <Flower x={312} y={158} scale={0.7} color="#e6a18f" />}
      {flowers >= 5 && <Flower x={214} y={180} scale={0.6} color="#f1bbca" />}
      <path d="M169 220H267L257 250H179Z" fill="#c38f74" />
      <path d="M169 220H267V228H169Z" fill="#daa789" />
      {growth >= 3 && (
        <g>
          <ellipse cx="338" cy="234" rx="21" ry="5" fill="#b3c09d" />
          <path d="M324 227Q325 207 339 211Q354 203 354 226Z" fill="#f6f0df" />
          <path
            d="M327 214L326 200L338 211M342 211L353 199L352 217"
            fill="#f6f0df"
          />
          <circle cx="334" cy="219" r="1.5" fill="#786a58" />
          <circle cx="345" cy="219" r="1.5" fill="#786a58" />
          <path d="M337 224Q340 226 343 223" fill="none" stroke="#b69b85" />
        </g>
      )}
      {growth >= 6 && (
        <g>
          <rect x="54" y="222" width="29" height="23" rx="5" fill="#a0b6b4" />
          <path
            d="M79 228l17-8 3 5-16 12M57 225q-13-17 6-16"
            fill="none"
            stroke="#a0b6b4"
            strokeWidth="5"
          />
        </g>
      )}
      {growth >= 10 && (
        <g>
          <path
            d="M285 243q14-9 24 0q10-9 24 0v17q-14-9-24-1q-10-8-24 1Z"
            fill="#fbf1dc"
          />
          <path d="M309 243v16" stroke="#bfaa88" strokeWidth="2" />
        </g>
      )}
      {growth >= 15 && (
        <g>
          <path
            d="M18 210V139H45V210"
            stroke="#a99578"
            strokeWidth="3"
            fill="none"
          />
          <rect x="22" y="145" width="19" height="29" rx="5" fill="#f3d48e" />
        </g>
      )}
      <g fill="#eee3aa">
        <path d="M67 118l3-8 3 8 8 3-8 3-3 8-3-8-8-3Z" />
        <path d="M288 58l2-5 2 5 5 2-5 2-2 5-2-5-5-2Z" />
      </g>
    </svg>
  );
}
export function StoryArt({
  kind,
  className = "",
}: {
  kind: Story["art"];
  className?: string;
}) {
  return (
    <svg viewBox="0 0 360 260" className={className} aria-hidden="true">
      <circle
        cx="189"
        cy="123"
        r="107"
        fill={
          {
            cafe: "#efdcd3",
            books: "#e0dbec",
            travel: "#dde8dd",
            friends: "#f4e5c7",
            home: "#dfe8d2",
          }[kind]
        }
      />
      {kind === "cafe" ? (
        <>
          <rect x="92" y="43" width="165" height="150" rx="76" fill="#d2ded7" />
          <path d="M92 115H257M175 44V192" stroke="#fbf8ef" strokeWidth="7" />
          {[115, 149, 201, 231].map((x, i) => (
            <path
              key={x}
              d={`M${x} ${70 + i * 8}l-5 12M${x + 5} ${110 + i * 5}l-5 12`}
              stroke="#9bbab2"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ))}
          <path
            d="M62 198H296"
            stroke="#baa691"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path d="M138 143H200L193 183Q166 202 144 183Z" fill="#fff9ee" />
          <path
            d="M200 151Q226 145 219 169Q215 180 197 177"
            fill="none"
            stroke="#fff9ee"
            strokeWidth="9"
          />
          <ellipse cx="169" cy="146" rx="30" ry="8" fill="#ab7d61" />
          <path
            d="M159 129Q148 115 161 99M180 127Q172 115 184 105"
            stroke="#fff9ee"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M220 191l15-36 43 20-14 31Z" fill="#dfa2a6" />
          <path
            d="M229 191l12-24 28 12"
            stroke="#f8e6dc"
            fill="none"
            strokeWidth="3"
          />
          <Flower x={96} y={153} scale={0.37} color="#e4bfa0" />
          <path d="M80 181H106L102 198H84Z" fill="#c79476" />
        </>
      ) : kind === "books" ? (
        <>
          <path d="M81 75H276V87H81ZM81 178H276V190H81Z" fill="#bda895" />
          <rect x="96" y="96" width="22" height="80" rx="3" fill="#cfa3a9" />
          <rect x="124" y="105" width="26" height="71" rx="3" fill="#baa9cd" />
          <rect x="158" y="98" width="21" height="78" rx="3" fill="#a4b59c" />
          <rect x="189" y="111" width="24" height="67" rx="3" fill="#dfbb83" />
          <path d="M223 105l20-5 20 74-20 5Z" fill="#9fb7b6" />
          <path
            d="M133 210Q155 192 183 207Q205 192 232 210V241Q207 223 183 238Q154 222 133 240Z"
            fill="#fff9ed"
          />
          <path d="M183 208V238" stroke="#d7cdb9" strokeWidth="2" />
          <Flower x={245} y={43} scale={0.39} color="#e3adbc" />
          <path d="M232 68H260L255 76H237Z" fill="#b58f7c" />
        </>
      ) : kind === "travel" ? (
        <>
          <path d="M60 149L132 63L190 148L249 74L310 157Z" fill="#a3b79e" />
          <path d="M115 83l17-20 14 21-12-4-9 6Z" fill="#fff8ec" />
          <path
            d="M65 180Q183 129 305 181"
            fill="none"
            stroke="#94b8b8"
            strokeWidth="32"
          />
          <path
            d="M158 235Q215 150 264 187"
            fill="none"
            stroke="#f0ddbb"
            strokeWidth="29"
          />
          <rect x="93" y="146" width="51" height="67" rx="11" fill="#ca9a81" />
          <path
            d="M105 147V139Q119 126 133 139V147"
            fill="none"
            stroke="#936c58"
            strokeWidth="5"
          />
          <path d="M108 161V201M129 161V201" stroke="#e7b69a" strokeWidth="4" />
          <circle cx="275" cy="50" r="22" fill="#f5d98f" />
        </>
      ) : kind === "friends" ? (
        <>
          <path
            d="M72 178H289"
            stroke="#ba9878"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path d="M91 188V233M269 188V233" stroke="#ba9878" strokeWidth="7" />
          <path
            d="M136 136H227Q224 169 181 173Q140 169 136 136Z"
            fill="#faf3e3"
          />
          <ellipse cx="181" cy="136" rx="45" ry="11" fill="#d6a471" />
          <g fill="#91a878">
            <ellipse cx="162" cy="135" rx="8" ry="3" />
            <ellipse cx="193" cy="134" rx="7" ry="3" />
          </g>
          <path
            d="M164 111Q151 97 165 83M197 111Q184 92 199 78"
            stroke="#faf4e9"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M96 136l21 6-4 24H100Z" fill="#cda6b2" />
          <path d="M246 136l21 6-4 24H250Z" fill="#a1b5a0" />
          <path
            d="M160 56Q141 36 151 27Q165 17 178 35Q191 18 204 29Q216 42 178 66Z"
            fill="#d8a4a3"
          />
        </>
      ) : (
        <>
          <rect x="70" y="55" width="220" height="148" rx="9" fill="#f5f1df" />
          <rect x="81" y="65" width="198" height="111" fill="#e3e9d5" />
          <path d="M181 65V175" stroke="#f7f3e7" strokeWidth="7" />
          <circle cx="236" cy="95" r="22" fill="#f3da91" />
          <Flower x={151} y={120} scale={0.78} />
          <Flower x={207} y={136} scale={0.63} color="#c5afd1" />
          <path d="M122 174H230L220 211H134Z" fill="#c59678" />
          <path
            d="M65 215H299M87 215V247M277 215V247"
            stroke="#a6b795"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </>
      )}
      <path
        d="M52 69l3-8 3 8 8 3-8 3-3 8-3-8-8-3ZM300 207l2-6 2 6 6 2-6 2-2 6-2-6-6-2Z"
        fill="#e8c882"
      />
    </svg>
  );
}
export function EnvelopeArt() {
  return (
    <svg viewBox="0 0 200 150" aria-hidden="true">
      <circle cx="100" cy="75" r="66" fill="#f1e4e6" />
      <g transform="rotate(-9 100 78)">
        <rect
          x="44"
          y="43"
          width="112"
          height="77"
          rx="8"
          fill="#fff8ee"
          stroke="#dbb5b9"
          strokeWidth="2"
        />
        <path
          d="M46 47L100 86L154 47M47 116L84 80M153 116L116 80"
          fill="none"
          stroke="#dbb5b9"
          strokeWidth="2"
        />
        <path
          d="M89 72Q81 59 91 57Q100 55 101 63Q107 53 115 59Q123 69 101 84Z"
          fill="#c98292"
        />
      </g>
    </svg>
  );
}
