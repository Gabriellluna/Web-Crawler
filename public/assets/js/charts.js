const FONT = { family: "'Space Grotesk', system-ui, sans-serif", size: 11 };

export function createBarChart({ canvas, empty, emptyMessage, horizontal = false, formatLabel }) {
  const theme = readTheme();
  let chart = null;

  function update(rows) {
    const data = (rows ?? []).filter((row) => row.count > 0);

    empty.hidden = data.length > 0;
    canvas.hidden = data.length === 0;

    if (data.length === 0) {
      empty.textContent = emptyMessage;
      if (chart) chart.destroy();
      chart = null;
      return;
    }

    const labels = data.map((row) => (formatLabel ? formatLabel(row.label) : row.label));
    const values = data.map((row) => row.count);

    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.update();
      return;
    }

    chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: theme.signal,
          borderRadius: 4,
          borderSkipped: horizontal ? "left" : "bottom",
          maxBarThickness: horizontal ? 18 : 44
        }]
      },
      options: buildOptions(theme, horizontal)
    });
  }

  return { update };
}

function buildOptions(theme, horizontal) {
  const valueAxis = {
    beginAtZero: true,
    border: { display: false },
    grid: { color: theme.rule, drawTicks: false },
    ticks: { color: theme.inkSoft, font: FONT, precision: 0, padding: 6 }
  };

  const labelAxis = {
    border: { color: theme.rule },
    grid: { display: false },
    ticks: {
      color: theme.inkMid,
      font: FONT,
      autoSkip: false,
      padding: 6,
      callback(value) {
        const label = this.getLabelForValue(value);
        return label.length > 26 ? `${label.slice(0, 25)}…` : label;
      }
    }
  };

  return {
    indexAxis: horizontal ? "y" : "x",
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 4 } },
    scales: horizontal
      ? { x: valueAxis, y: labelAxis }
      : { x: labelAxis, y: valueAxis },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.ink,
        titleFont: { ...FONT, size: 12, weight: "600" },
        bodyFont: FONT,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (context) => `${context.parsed[horizontal ? "x" : "y"]} vagas`
        }
      }
    }
  };
}

function readTheme() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name) => styles.getPropertyValue(name).trim();

  return {
    signal: read("--signal"),
    ink: read("--ink"),
    inkMid: read("--ink-mid"),
    inkSoft: read("--ink-soft"),
    rule: read("--rule")
  };
}
