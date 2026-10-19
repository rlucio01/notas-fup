import React from "react";

/**
 * Efeito visual de queima incandescente e brasas para tarefas concluídas.
 * Renderiza uma onda de calor/chamas que varre o card acompanhada por
 * faíscas incandescentes flutuantes e desintegração em cinzas.
 */
export const BurnOverlay: React.FC = () => {
  return (
    <div className="burn-overlay" aria-hidden="true">
      <div className="burn-smoke" />
      <div className="burn-flame-wave" />
      <div className="burn-fire-spark burn-spark-1" />
      <div className="burn-fire-spark burn-spark-2" />
      <div className="burn-fire-spark burn-spark-3" />
      <div className="burn-fire-spark burn-spark-4" />
      <div className="burn-fire-spark burn-spark-5" />
      <div className="burn-fire-spark burn-spark-6" />
    </div>
  );
};

export default BurnOverlay;
