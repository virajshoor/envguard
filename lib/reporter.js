const chalk = require('chalk');

function visibleLength(value) {
  return String(value).replace(/\u001b\[[0-9;]*m/g, '').length;
}

function pad(value, width) {
  const text = String(value);
  return text + ' '.repeat(Math.max(0, width - visibleLength(text)));
}

function buildTable(rows) {
  const headers = ['Status', 'Key', 'Type', 'Required', 'Reason'];
  const widths = headers.map((header, columnIndex) => {
    return Math.max(
      visibleLength(header),
      ...rows.map((row) => visibleLength(row[columnIndex]))
    );
  });

  const line = widths.map((width) => '-'.repeat(width)).join('-+-');
  const header = headers.map((label, index) => pad(chalk.bold(label), widths[index])).join(' | ');
  const body = rows
    .map((row) => row.map((value, index) => pad(value, widths[index])).join(' | '))
    .join('\n');

  return `${header}\n${line}\n${body}`;
}

function formatResults(results) {
  const rows = results.map((result) => [
    result.pass ? chalk.green('PASS') : chalk.red('FAIL'),
    result.key,
    result.type,
    result.required ? 'yes' : 'no',
    result.pass ? chalk.green(result.reason) : chalk.red(result.reason)
  ]);

  return buildTable(rows);
}

function formatSummary(results) {
  const failed = results.filter((result) => !result.pass).length;
  const passed = results.length - failed;

  if (failed === 0) {
    return chalk.green(`\n${passed}/${results.length} checks passed. Environment is valid.`);
  }

  return chalk.red(`\n${failed}/${results.length} checks failed. Fix your env file before deploying.`);
}

module.exports = {
  formatResults,
  formatSummary
};
