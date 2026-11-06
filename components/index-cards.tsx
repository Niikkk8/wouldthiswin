import { copy } from "@/lib/copy";

const TILTS = ["-rotate-[1.2deg]", "rotate-[0.8deg]", "rotate-[1.4deg]", "-rotate-[0.7deg]"];

/** The fine print, on ruled index cards taped to the board. */
export function IndexCards() {
  return (
    <ul className="grid gap-8 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-12">
      {copy.finePrint.items.map((item, i) => (
        <li
          key={item.q}
          className={`grain relative bg-white px-6 pb-6 pt-5 shadow-[0_1px_1px_rgb(0_0_0/0.12),0_3px_6px_-3px_rgb(0_0_0/0.2)] ${TILTS[i % TILTS.length]}`}
          style={{
            // Ruled like a real index card: one red header rule, faint blue lines below it.
            backgroundImage:
              "linear-gradient(transparent 51px, rgb(215 38 61 / 0.55) 51px, rgb(215 38 61 / 0.55) 53px, transparent 53px), repeating-linear-gradient(transparent 0 27px, rgb(45 91 227 / 0.13) 27px 28px)",
            backgroundPosition: "0 0, 0 53px",
          }}
        >
          <span
            className={`tape -top-3 ${i % 2 ? "right-8 rotate-3" : "left-8 -rotate-3"}`}
            aria-hidden="true"
          />
          <h3 className="font-hand text-2xl font-bold leading-tight">{item.q}</h3>
          <p className="mt-6 leading-7 text-graphite text-pretty">{item.a}</p>
        </li>
      ))}
    </ul>
  );
}
