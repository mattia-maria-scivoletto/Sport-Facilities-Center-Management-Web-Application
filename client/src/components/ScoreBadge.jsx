import React from 'react';
import { Badge } from 'react-bootstrap';

function ScoreBadge({ score, isTotp }) {
  if (score === undefined || score === null) return null;

  const isNegative = score < 0;

  return (
    <div className="d-inline-flex align-items-center gap-1">
      <Badge
        bg={isNegative ? 'danger' : 'success'}
        style={{ fontSize: '0.85rem', padding: '6px 10px' }}
        title={
          isNegative
            ? `Score penalty: ${score}. Only mandatory minimum equipment allowed. Log in with 2FA TOTP to reset score to 0.`
            : 'Normal score (0). Full booking and equipment privileges.'
        }
      >
        Score: {score}
        {isNegative && ' (Penalty)'}
      </Badge>
      {isTotp && (
        <Badge bg="info" text="dark" style={{ fontSize: '0.75rem', padding: '5px 8px' }}>
          2FA Active
        </Badge>
      )}
    </div>
  );
}

export default ScoreBadge;