import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import './OrganizerCabinetPage.css';

const OrganizerCabinetPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="organizer-cabinet-page">
      <div className="organizer-cabinet-card">
        <h1>Кабинет организатора</h1>
        <p className="organizer-cabinet-muted">
          Здесь вы создаёте и настраиваете конкурсы. Публичный интерфейс остаётся чистым — без админских кнопок.
        </p>
        <div className="organizer-cabinet-actions">
          <Button onClick={() => navigate('/organizer/contests/new')}>Создать конкурс</Button>
        </div>
      </div>
    </div>
  );
};

export default OrganizerCabinetPage;

