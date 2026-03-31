type ReportSectionProps = {
  titre: string;
  situation: string;
  analyse: string;
  transformation: string;
  resultat: string;
};

export default function ReportSection({
  titre,
  situation,
  analyse,
  transformation,
  resultat,
}: ReportSectionProps) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        padding: "24px",
        marginTop: "24px",
        backgroundColor: "#ffffff",
        boxShadow: "0 6px 18px rgba(0, 0, 0, 0.06)",
        textAlign: "left",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: "18px",
          fontSize: "24px",
          color: "#0f172a",
          textAlign: "left",
        }}
      >
        {titre}
      </h2>

      <p
        style={{
          marginTop: 0,
          marginBottom: "8px",
          fontWeight: "bold",
          color: "#334155",
          textAlign: "left",
        }}
      >
        Situation actuelle
      </p>
      <ul
        style={{
          marginTop: 0,
          marginBottom: "16px",
          paddingLeft: "24px",
          color: "#475569",
          lineHeight: 1.7,
          textAlign: "left",
        }}
      >
        <li>{situation}</li>
      </ul>

      <p
        style={{
          marginTop: 0,
          marginBottom: "8px",
          fontWeight: "bold",
          color: "#334155",
          textAlign: "left",
        }}
      >
        Analyse
      </p>
      <ul
        style={{
          marginTop: 0,
          marginBottom: "16px",
          paddingLeft: "24px",
          color: "#475569",
          lineHeight: 1.7,
          textAlign: "left",
        }}
      >
        <li>{analyse}</li>
      </ul>

      <p
        style={{
          marginTop: 0,
          marginBottom: "8px",
          fontWeight: "bold",
          color: "#334155",
          textAlign: "left",
        }}
      >
        Transformation possible
      </p>
      <ul
        style={{
          marginTop: 0,
          marginBottom: "16px",
          paddingLeft: "24px",
          color: "#475569",
          lineHeight: 1.7,
          textAlign: "left",
        }}
      >
        <li>{transformation}</li>
      </ul>

      <p
        style={{
          marginTop: 0,
          marginBottom: "8px",
          fontWeight: "bold",
          color: "#334155",
          textAlign: "left",
        }}
      >
        Résultat attendu
      </p>
      <ul
        style={{
          marginTop: 0,
          marginBottom: 0,
          paddingLeft: "24px",
          color: "#475569",
          lineHeight: 1.7,
          textAlign: "left",
        }}
      >
        <li>{resultat}</li>
      </ul>
    </div>
  );
}