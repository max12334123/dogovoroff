const COMMON_QUESTIONS = Object.freeze([
  {
    id: "applicantType",
    type: "radio",
    label: "Кто обращается?",
    options: [
      ["organization", "Организация"],
      ["entrepreneur", "Индивидуальный предприниматель"],
      ["individual", "Частное лицо"],
    ],
  },
  {
    id: "stage",
    type: "select",
    label: "На какой стадии находится ситуация?",
    options: [
      ["information", "Сбор информации"],
      ["documents", "Подготовка документов"],
      ["negotiations", "Переговоры"],
      ["claim", "Претензия"],
      ["court", "Суд"],
      ["enforcement", "Исполнение решения"],
    ],
  },
  {
    id: "goal",
    type: "textarea",
    label: "Какого результата вы хотите достичь?",
    maxLength: 300,
  },
  {
    id: "deadline",
    type: "date",
    label: "Известная дата или крайний срок",
    required: false,
  },
]);

const PRACTICE_DEFINITIONS = [
  {
    id: "tenders",
    label: "Тендеры и государственные закупки",
    service: "Тендеры и госзакупки (44-ФЗ, 223-ФЗ)",
    questions: [
      {
        id: "procurementType",
        type: "radio",
        label: "Вид закупки",
        options: [["law_44", "44-ФЗ"], ["law_223", "223-ФЗ"], ["commercial", "Коммерческая"]],
      },
      {
        id: "procurementTask",
        type: "select",
        label: "Какая задача стоит сейчас?",
        options: [
          ["documentation", "Анализ документации"],
          ["application", "Подготовка заявки"],
          ["contract", "Работа с контрактом"],
          ["security", "Обеспечение"],
          ["guarantee", "Банковская гарантия"],
        ],
      },
      {
        id: "procurementDeadline",
        type: "date",
        label: "Дата подачи или исполнения",
        required: false,
      },
    ],
    fallbackMissingInformation: [
      "Номер и способ проведения закупки",
      "Точный срок подачи заявки или исполнения обязательства",
      "Условия обеспечения и требования к участнику",
    ],
    fallbackDocuments: [
      "Извещение и закупочная документация",
      "Проект контракта",
      "Техническое задание",
      "Документы участника, относящиеся к требованиям закупки",
    ],
    fallbackQuestions: [
      "Какой этап закупки уже пройден?",
      "Какой результат требуется получить к указанной дате?",
      "Есть ли условия, которые невозможно выполнить в текущем виде?",
    ],
    fallbackNextStep: "Подготовьте документацию и точную дату ближайшего действия для первичной проверки юристом.",
  },
  {
    id: "business",
    label: "Юридический аутсорсинг бизнеса",
    service: "Юридический аутсорсинг бизнеса",
    questions: [
      {
        id: "supportMode",
        type: "radio",
        label: "Какой формат поддержки требуется?",
        options: [["one_off", "Разовая задача"], ["ongoing", "Постоянная поддержка"]],
      },
      {
        id: "businessTopic",
        type: "select",
        label: "Основная тема",
        options: [
          ["contracts", "Договоры"],
          ["inspections", "Проверки"],
          ["debt", "Задолженность"],
          ["operations", "Текущая деятельность"],
        ],
      },
      {
        id: "interactionFrequency",
        type: "radio",
        label: "Как часто нужна правовая поддержка?",
        options: [["as_needed", "По мере задач"], ["weekly", "Еженедельно"], ["daily", "Почти ежедневно"]],
      },
    ],
    fallbackMissingInformation: [
      "Организационно-правовая форма и сфера деятельности",
      "Перечень регулярных и срочных правовых задач",
      "Текущий объём документов и договоров",
    ],
    fallbackDocuments: [
      "Примеры действующих договоров",
      "Внутренние регламенты по соответствующей задаче",
      "Полученные претензии или требования",
    ],
    fallbackQuestions: [
      "Какие задачи возникают регулярно?",
      "Есть ли вопрос с фиксированным сроком?",
      "Кто будет контактным лицом по текущим задачам?",
    ],
    fallbackNextStep: "Составьте короткий перечень текущих задач и приоритетов для проверки юристом и определения формата сопровождения.",
  },
  {
    id: "housing",
    label: "ЖКХ, управляющие компании и ТСЖ",
    service: "ЖКХ, УК и ТСЖ",
    questions: [
      {
        id: "housingRole",
        type: "radio",
        label: "Ваша роль в ситуации",
        options: [
          ["management_company", "Управляющая компания"],
          ["hoa", "ТСЖ"],
          ["contractor", "Подрядчик"],
          ["owner", "Собственник"],
        ],
      },
      {
        id: "housingTopic",
        type: "select",
        label: "Основная тема",
        options: [
          ["inspection", "ГЖИ"],
          ["resource", "Ресурсоснабжающая организация"],
          ["debt", "Задолженность"],
          ["contractor", "Подрядчик"],
          ["building_management", "Управление домом"],
        ],
      },
      {
        id: "disputeStatus",
        type: "radio",
        label: "Есть ли официальный документ или разбирательство?",
        options: [
          ["none", "Пока нет"],
          ["order", "Получено предписание"],
          ["claim", "Получена претензия"],
          ["proceedings", "Разбирательство уже началось"],
        ],
      },
    ],
    fallbackMissingInformation: [
      "Адрес и статус объекта без персональных данных жильцов",
      "Дата получения последнего официального документа",
      "Содержание требований второй стороны или органа",
    ],
    fallbackDocuments: [
      "Предписание, претензия или иск",
      "Договор управления или профильный договор",
      "Акты, протоколы и переписка по ситуации",
    ],
    fallbackQuestions: [
      "Какой документ требует ближайшего ответа?",
      "Какие действия уже предпринимались?",
      "Есть ли установленный срок исполнения или ответа?",
    ],
    fallbackNextStep: "Соберите последний официальный документ и связанные с ним договоры и акты для проверки сроков и позиции юристом.",
  },
  {
    id: "litigation",
    label: "Арбитраж и суды",
    service: "Арбитраж и суды",
    questions: [
      {
        id: "courtRole",
        type: "radio",
        label: "Ваша роль",
        options: [["claimant", "Истец"], ["defendant", "Ответчик"], ["pre_filing", "Иск ещё не подан"]],
      },
      {
        id: "courtStage",
        type: "radio",
        label: "Стадия спора",
        options: [["pretrial", "Досудебная"], ["court", "Судебная"], ["enforcement", "Исполнительное производство"]],
      },
      {
        id: "hearingDate",
        type: "date",
        label: "Дата заседания или процессуальный срок",
        required: false,
      },
    ],
    fallbackMissingInformation: [
      "Наименование суда и номер дела, если дело уже возбуждено",
      "Дата ближайшего заседания или процессуального действия",
      "Требования сторон и сумма спора",
    ],
    fallbackDocuments: [
      "Иск, отзыв или полученные судебные документы",
      "Договор и первичные документы",
      "Претензионная переписка",
      "Имеющиеся доказательства исполнения обязательств",
    ],
    fallbackQuestions: [
      "Какой судебный документ получен последним?",
      "Какие требования нужно заявить или оспорить?",
      "Какие доказательства уже представлены суду?",
    ],
    fallbackNextStep: "Передайте последний судебный документ и укажите ближайшую дату, чтобы юрист сначала проверил процессуальные сроки.",
  },
  {
    id: "contracts",
    label: "Договоры, претензии и переговоры",
    service: "Договоры и претензии",
    questions: [
      {
        id: "contractTask",
        type: "radio",
        label: "Что требуется?",
        options: [["draft", "Подготовить"], ["review", "Проверить"], ["negotiate", "Согласовать"], ["claim", "Подготовить претензию"]],
      },
      {
        id: "signed",
        type: "radio",
        label: "Договор уже подписан?",
        options: [["yes", "Да"], ["no", "Нет"], ["unknown", "Не знаю"]],
      },
      {
        id: "mainRisk",
        type: "radio",
        label: "Основной риск",
        options: [["payment", "Оплата"], ["time", "Сроки"], ["liability", "Ответственность"], ["quality", "Качество"], ["termination", "Расторжение"]],
      },
    ],
    fallbackMissingInformation: [
      "Предмет и существенные условия договора",
      "Согласованный срок подписания или ответа",
      "Позиция второй стороны по спорным условиям",
    ],
    fallbackDocuments: [
      "Актуальный проект договора со всеми приложениями",
      "Протокол разногласий, если он есть",
      "Переписка по спорным условиям",
      "Претензия и подтверждающие документы, если возникло нарушение",
    ],
    fallbackQuestions: [
      "Какие условия вызывают наибольший риск?",
      "Можно ли изменить предложенную редакцию?",
      "Какой результат переговоров будет приемлемым?",
    ],
    fallbackNextStep: "Передайте актуальную версию документа и отметьте спорные условия для предметной проверки юристом.",
  },
  {
    id: "private",
    label: "Частный вопрос",
    service: "Другое / не знаю",
    questions: [
      {
        id: "privateCategory",
        type: "select",
        label: "Общая категория ситуации",
        options: [
          ["consumer", "Защита прав потребителя"],
          ["property", "Имущество или недвижимость"],
          ["family", "Семейный вопрос"],
          ["inheritance", "Наследство"],
          ["other", "Другое"],
        ],
      },
      {
        id: "existingDocuments",
        type: "textarea",
        label: "Какие документы уже есть?",
        maxLength: 300,
        required: false,
      },
      {
        id: "assignedDates",
        type: "radio",
        label: "Есть ли назначенные даты или полученные требования?",
        options: [["none", "Нет"], ["deadline", "Есть крайний срок"], ["requirement", "Получено требование"], ["hearing", "Назначено заседание"]],
      },
    ],
    fallbackMissingInformation: [
      "Кто является второй стороной без указания лишних персональных данных",
      "Когда произошло ключевое событие",
      "Какой результат требуется получить",
    ],
    fallbackDocuments: [
      "Полученные договоры, требования или уведомления",
      "Переписка, относящаяся к ситуации",
      "Документы, подтверждающие оплату или иные действия",
    ],
    fallbackQuestions: [
      "Что произошло и в какой последовательности?",
      "Есть ли документ с обязательным сроком ответа?",
      "Какие действия уже предпринимались?",
    ],
    fallbackNextStep: "Соберите документы по хронологии и укажите ближайшую известную дату для первичного разбора юристом.",
  },
];

function freezePractice(practice) {
  return Object.freeze({
    ...practice,
    questions: Object.freeze([
      ...COMMON_QUESTIONS,
      ...practice.questions,
    ].map((question) => Object.freeze({
      ...question,
      ...(question.options
        ? { options: Object.freeze(question.options.map((option) => Object.freeze([...option]))) }
        : {}),
    }))),
    fallbackMissingInformation: Object.freeze([...practice.fallbackMissingInformation]),
    fallbackDocuments: Object.freeze([...practice.fallbackDocuments]),
    fallbackQuestions: Object.freeze([...practice.fallbackQuestions]),
  });
}

export const PRECHECK_PRACTICES = Object.freeze(PRACTICE_DEFINITIONS.map(freezePractice));
export const PRECHECK_PRACTICE_IDS = Object.freeze(PRECHECK_PRACTICES.map(({ id }) => id));

const SERVICE_TO_PRACTICE = new Map(
  PRECHECK_PRACTICES.map(({ id, service }) => [service, id]),
);

export function practiceIdFromService(service) {
  return SERVICE_TO_PRACTICE.get(typeof service === "string" ? service.trim() : "") || "private";
}
